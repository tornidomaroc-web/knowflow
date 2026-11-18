/**
 * A THROWAWAY APP STORE-SHAPED SIGNING CHAIN, made fresh on every run with
 * openssl, for the Apple IAP proofs (scripts/verify-apple-iap.mjs,
 * scripts/verify-apple-subscriptions-db.mjs). Nothing is committed: no key of
 * any kind lives in the repository, and the directory is removed on exit.
 *
 * The chain copies the shape Apple signs with, so the verifier's real checks
 * all run: a root CA; an intermediate CA carrying Apple's WWDR marker OID
 * 1.2.840.113635.100.6.2.1; a leaf (not a CA) carrying the App Store receipt
 * marker OID 1.2.840.113635.100.6.11.1, with a P-256 key. Variants exist only
 * to be REFUSED: a leaf without the marker, an intermediate without its
 * marker, a second root with its own intermediate and leaf, a stranger's key.
 * (A certificate outside its validity is reached with a signedDate before
 * the chain was made; openssl 3.0 on the CI runner has no -not_before.)
 *
 * `sign(payload, opts)` makes a compact ES256 JWS with `x5c` [leaf,
 * intermediate, root], exactly the header StoreKit 2 and App Store Server
 * Notifications V2 send.
 */
import { execFileSync } from 'node:child_process';
import { createPrivateKey, sign as cryptoSign, X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONFIG = `
[req]
distinguished_name = dn
prompt = no
[dn]
CN = unused
[v3_root]
basicConstraints = critical,CA:true
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
[v3_inter]
basicConstraints = critical,CA:true,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid
1.2.840.113635.100.6.2.1 = ASN1:NULL
[v3_inter_nomarker]
basicConstraints = critical,CA:true,pathlen:0
keyUsage = critical,keyCertSign,cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid
[v3_leaf]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
authorityKeyIdentifier = keyid
1.2.840.113635.100.6.11.1 = ASN1:NULL
[v3_leaf_nomarker]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
authorityKeyIdentifier = keyid
`;

export function makeAppleTestChain() {
  const dir = mkdtempSync(join(tmpdir(), 'kf-apple-chain-'));
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  process.on('exit', cleanup);
  const f = (name) => join(dir, name);
  const ossl = (...args) => execFileSync('openssl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  writeFileSync(f('ext.cnf'), CONFIG);

  const key = (name) => ossl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', f(`${name}.key`));
  const selfSigned = (name, cn) => {
    key(name);
    ossl('req', '-new', '-x509', '-key', f(`${name}.key`), '-out', f(`${name}.pem`), '-days', '3650', '-subj', `/CN=${cn}`,
      '-config', f('ext.cnf'), '-extensions', 'v3_root');
  };
  const issued = (name, cn, issuer, ext, extra = []) => {
    key(name);
    ossl('req', '-new', '-key', f(`${name}.key`), '-out', f(`${name}.csr`), '-subj', `/CN=${cn}`, '-config', f('ext.cnf'));
    ossl('x509', '-req', '-in', f(`${name}.csr`), '-CA', f(`${issuer}.pem`), '-CAkey', f(`${issuer}.key`), '-set_serial',
      String(Math.floor(Math.random() * 1e9)), '-out', f(`${name}.pem`), '-extfile', f('ext.cnf'), '-extensions', ext, ...extra);
  };

  selfSigned('root', 'KnowFlow Test Root CA (proof only)');
  issued('inter', 'KnowFlow Test WWDR (proof only)', 'root', 'v3_inter', ['-days', '3650']);
  issued('leaf', 'KnowFlow Test App Store Signing (proof only)', 'inter', 'v3_leaf', ['-days', '3650']);
  issued('leafNoMarker', 'KnowFlow Test Leaf Without Marker (proof only)', 'inter', 'v3_leaf_nomarker', ['-days', '3650']);
  issued('interNoMarker', 'KnowFlow Test Intermediate Without Marker (proof only)', 'root', 'v3_inter_nomarker', ['-days', '3650']);
  issued('leafUnderNoMarker', 'KnowFlow Test Leaf Under Unmarked Intermediate (proof only)', 'interNoMarker', 'v3_leaf', ['-days', '3650']);
  selfSigned('otherRoot', 'Stranger Root CA (proof only)');
  issued('otherInter', 'Stranger WWDR (proof only)', 'otherRoot', 'v3_inter', ['-days', '3650']);
  issued('otherLeaf', 'Stranger Signing (proof only)', 'otherInter', 'v3_leaf', ['-days', '3650']);
  key('stranger');

  const pem = (name) => readFileSync(f(`${name}.pem`), 'utf8');
  const der64 = (name) => new X509Certificate(pem(name)).raw.toString('base64');
  const privateKey = (name) => createPrivateKey(readFileSync(f(`${name}.key`), 'utf8'));

  const b64u = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

  /**
   * opts.chain: [leafName, interName, rootName] (default the good chain);
   * opts.key: which key signs (default the leaf's own);
   * opts.header: fields merged over { alg, x5c }.
   */
  function sign(payload, opts = {}) {
    const [l, i, r] = opts.chain ?? ['leaf', 'inter', 'root'];
    const header = { alg: 'ES256', x5c: [der64(l), der64(i), der64(r)], ...(opts.header ?? {}) };
    const head = b64u(header);
    const body = b64u(payload);
    const sig = cryptoSign('sha256', Buffer.from(`${head}.${body}`), { key: privateKey(opts.key ?? l), dsaEncoding: 'ieee-p1363' });
    return `${head}.${body}.${sig.toString('base64url')}`;
  }

  return {
    sign,
    root: new X509Certificate(pem('root')),
    otherRoot: new X509Certificate(pem('otherRoot')),
    der64,
    cleanup,
  };
}
