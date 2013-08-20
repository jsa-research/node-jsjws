/*global it: false,
         jsjws: false, 
         expect: false,
         pub_keys: false,
         payload: false,
         RSAKey: false,
         KJUR: false,
         priv_pem: false,
         spayload: false,
         priv_keys: false,
         pub_pem: false,
         describe: false,
         before: false,
         wd: false,
         after: false,
         browser_sigs: false */
/*jslint node: true, forin: true */
"use strict";

function verify_premade_browser_sig(alg, pub_key)
{
    it('should verify pre-made signature generated by browser using algorithm=' + alg +
       ', pub_key=' + pub_key, function ()
    {
        var jws = new jsjws.JWS();
        expect(jws.verifyJWSByKey(browser_sigs[alg], pub_keys[pub_key])).to.equal(true);
        expect(jws.getParsedPayload()).to.eql(payload);
        expect(jws.getParsedHeader()).to.eql({ alg: alg });
    });
}

var browser;

function verify_browser_sig(alg, pub_key)
{
    var header = JSON.stringify({ alg: alg });

    it('should verify signature made by browser using algorithm=' + alg +
       ', pub_key=' + pub_key, function (cb)
    {
        var f = function (priv_pem, header, spayload)
        {
            var r = {}, key;

            try
            {
                key = new RSAKey();
                key.readPrivateKeyFromPEMString(priv_pem);

                r.sjws = new KJUR.jws.JWS().generateJWSByKey(header, spayload, key);
            }
            catch (ex)
            {
                r.err = ex.toString();
            }
            
            return JSON.stringify(r);
        };
        
        browser.execute('return ' + f + '.apply(this, arguments)',
                        [priv_pem, header, spayload],
        function (err, r)
        {
            if (err)
            {
                cb(err);
                return;
            }

            r = JSON.parse(r);

            if (r.err)
            {
                cb(r.err);
                return;
            }

            try
            {
                var jws = new jsjws.JWS();
                expect(jws.verifyJWSByKey(r.sjws, pub_keys[pub_key])).to.equal(true);
                expect(jws.getUnparsedPayload()).to.equal(spayload);
                expect(jws.getUnparsedHeader()).to.equal(header);
            }
            catch (ex)
            {
                cb(ex);
                return;
            }

            cb();
        });
    });
}

function verify_sig_in_browser(alg, priv_key)
{
    var header = JSON.stringify({ alg: alg });

    it('should generate a signature that can be verified in browser using algorithm=' + alg +
       ', priv_key=' + priv_key, function (cb)
    {
        var sjws = new jsjws.JWS().generateJWSByKey(header, spayload, priv_keys[priv_key]),
        
        f = function (pub_pem, sjws)
        {
            var r = {}, key, jws;

            try
            {
                key = new RSAKey();
                key.readPublicKeyFromPEMString(pub_pem);

                jws = new KJUR.jws.JWS();
                r.verified = jws.verifyJWSByKey(sjws, key);

                if (r.verified)
                {
                    r.payload = jws.getUnparsedPayload();
                    r.header = jws.getUnparsedHeader();
                }
            }
            catch (ex)
            {
                r.err = ex.toString();
            }

            return JSON.stringify(r);
        };
        
        browser.execute('return ' + f + '.apply(this, arguments)',
                        [pub_pem, sjws],
        function (err, r)
        {
            if (err)
            {
                cb(err);
                return;
            }

            r = JSON.parse(r);

            if (r.err)
            {
                cb(r.err);
                return;
            }

            try
            {
                expect(r.verified).to.equal(true);
                expect(r.payload).to.equal(spayload);
                expect(r.header).to.equal(header);
            }
            catch (ex)
            {
                cb(ex);
                return;
            }

            cb();
        });
    });
}

function generate_key_in_browser_and_verify_sig(alg)
{
    var header = JSON.stringify({ alg: alg });

    it('should generate key in browser and verify signature using algorithm=' + alg, function (cb)
    {
        var f = function (header, spayload)
        {
            var r = {}, key;

            try
            {
                key = new RSAKey();
                key.generate(2048, '10001');

                r.pub_pem = key.publicKeyToPEMString();
                r.sjws = new KJUR.jws.JWS().generateJWSByKey(header, spayload, key);
            }
            catch (ex)
            {
                r.err = ex.toString();
            }

            return JSON.stringify(r);
        };
        
        browser.execute('return ' + f + '.apply(this, arguments)',
                        [header, spayload],
        function (err, r)
        {
            if (err)
            {
                cb(err);
                return;
            }

            r = JSON.parse(r);

            if (r.err)
            {
                cb(r.err);
                return;
            }

            try
            {
                var pub_key, jws;

                pub_key = jsjws.createPublicKey(r.pub_pem, 'utf8');
                jws = new jsjws.JWS();
                expect(jws.verifyJWSByKey(r.sjws, pub_key)).to.equal(true);
                expect(jws.getUnparsedPayload()).to.equal(spayload);
                expect(jws.getUnparsedHeader()).to.equal(header);

                pub_key = new jsjws.SlowRSAKey();
                pub_key.readPublicKeyFromPEMString(r.pub_pem);
                jws = new jsjws.JWS();
                expect(jws.verifyJWSByKey(r.sjws, pub_key)).to.equal(true);
                expect(jws.getUnparsedPayload()).to.equal(spayload);
                expect(jws.getUnparsedHeader()).to.equal(header);
            }
            catch (ex)
            {
                cb(ex);
                return;
            }

            cb();
        });
    });
}

describe('browser-interop', function ()
{
    before(function (cb)
    {
        browser = wd.remote();

        browser.init(function (err)
        {
            if (err)
            {
                cb(err);
                return;
            }

            browser.get('test/fixtures/loader.html', function (err)
            {
                if (err)
                {
                    cb(err);
                    return;
                }

                cb();
            });
        });
    });

    after(function ()
    {
        browser.quit();
    });

    var algs = ['RS256', 'RS512', 'PS256', 'PS512'],
        i, pub_key, priv_key;

    for (i = 0; i < algs.length; i += 1)
    {
        for (pub_key in pub_keys)
        {
            verify_premade_browser_sig(algs[i], pub_key);
            verify_browser_sig(algs[i], pub_key);
        }

        for (priv_key in priv_keys)
        {
            verify_sig_in_browser(algs[i], priv_key);
        }

        generate_key_in_browser_and_verify_sig(algs[i]);
    }
});

