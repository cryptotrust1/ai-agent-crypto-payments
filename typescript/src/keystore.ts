/**
 * Encrypted local keystore (AES-256-GCM, scrypt KDF). The private key NEVER
 * leaves the machine the agent runs on and is NEVER sent to AceChange.
 *
 * ⚠ Security: a real, fund-holding wallet must be independently audited before
 * production. This is the open-source reference implementation.
 */
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export interface KeystoreBlob {
  v: 1;
  kdf: 'scrypt';
  salt: string; // hex
  iv: string;   // hex
  ct: string;   // hex (ciphertext)
  tag: string;  // hex (GCM auth tag)
}

const N = 1 << 15, r = 8, p = 1; // scrypt params

export function encryptPrivateKey(privateKeyHex: string, passphrase: string): KeystoreBlob {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, { N, r, p });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(privateKeyHex.replace(/^0x/, ''), 'hex')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, kdf: 'scrypt', salt: salt.toString('hex'), iv: iv.toString('hex'), ct: ct.toString('hex'), tag: tag.toString('hex') };
}

export function decryptPrivateKey(blob: KeystoreBlob, passphrase: string): `0x${string}` {
  const key = scryptSync(passphrase, Buffer.from(blob.salt, 'hex'), 32, { N, r, p });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(blob.tag, 'hex'));
  const pt = Buffer.concat([decipher.update(Buffer.from(blob.ct, 'hex')), decipher.final()]);
  return ('0x' + pt.toString('hex')) as `0x${string}`;
}

export function saveKeystore(path: string, blob: KeystoreBlob): void {
  writeFileSync(path, JSON.stringify(blob), { mode: 0o600 });
}
export function loadKeystore(path: string): KeystoreBlob {
  return JSON.parse(readFileSync(path, 'utf8')) as KeystoreBlob;
}
