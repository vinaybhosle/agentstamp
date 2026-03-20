const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let privateKey;
let publicKey;

function initialize() {
  const keyPath = path.resolve(config.signingKeyPath);
  const keyDir = path.dirname(keyPath);
  const pubKeyPath = keyPath.replace('_private.pem', '_public.pem');

  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { recursive: true });
  }

  if (fs.existsSync(keyPath)) {
    privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));
    publicKey = crypto.createPublicKey(privateKey);
  } else {
    const keypair = crypto.generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    fs.writeFileSync(keyPath, keypair.privateKey, { mode: 0o600 });
    fs.writeFileSync(pubKeyPath, keypair.publicKey);

    privateKey = crypto.createPrivateKey(keypair.privateKey);
    publicKey = crypto.createPublicKey(keypair.publicKey);
  }
}

function sortKeysDeep(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = sortKeysDeep(obj[key]);
    return acc;
  }, {});
}

function signCertificate(certificateObj) {
  const canonical = JSON.stringify(sortKeysDeep(certificateObj));
  const signature = crypto.sign(null, Buffer.from(canonical), privateKey);
  return signature.toString('base64');
}

function verifyCertificate(certificateObj, signatureBase64) {
  const canonical = JSON.stringify(sortKeysDeep(certificateObj));
  const signature = Buffer.from(signatureBase64, 'base64');
  return crypto.verify(null, Buffer.from(canonical), publicKey, signature);
}

function getPublicKey() {
  const exported = publicKey.export({ type: 'spki', format: 'der' });
  return exported.toString('base64');
}

module.exports = { initialize, signCertificate, verifyCertificate, getPublicKey };
