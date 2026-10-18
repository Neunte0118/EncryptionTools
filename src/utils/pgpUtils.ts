/**
 * OpenPGP Utility Functions
 *
 * Implements standard RFC 4880 OpenPGP key pair generation, message encryption,
 * message decryption, digital signatures, and ASCII armor handling.
 */

import * as openpgp from 'openpgp';

export interface PgpKeyPair {
  publicKeyArmored: string;
  privateKeyArmored: string;
  revocationCertificate?: string;
  keyID?: string;
  fingerprint?: string;
}

/**
 * Generate standard OpenPGP Key Pair (RSA 2048/4096 or ECC Curve25519)
 */
export async function generatePgpKeyPair(options: {
  name: string;
  email: string;
  passphrase?: string;
  type?: 'ecc' | 'rsa';
  rsaBits?: 2048 | 4096;
}): Promise<PgpKeyPair> {
  const userIDs = [{ name: options.name, email: options.email }];
  const keyType = options.type || 'ecc';

  let keyConfig: any;
  if (keyType === 'ecc') {
    keyConfig = { type: 'ed25519' as const };
  } else {
    keyConfig = { type: 'rsa' as const, rsaBits: options.rsaBits || 2048 };
  }

  const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
    type: keyConfig.type,
    rsaBits: keyConfig.rsaBits,
    userIDs,
    passphrase: options.passphrase || undefined,
  });

  const parsedKey = await openpgp.readKey({ armoredKey: publicKey });
  const keyID = parsedKey.getKeyID().toHex().toUpperCase();
  const fingerprint = parsedKey.getFingerprint().toUpperCase();

  return {
    publicKeyArmored: publicKey,
    privateKeyArmored: privateKey,
    revocationCertificate,
    keyID,
    fingerprint,
  };
}

/**
 * Encrypt a plaintext message with one or more OpenPGP Public Keys or Passphrase
 */
export async function encryptPgpMessage(options: {
  plaintext: string;
  publicKeyArmored?: string;
  passphrase?: string;
  signingPrivateKeyArmored?: string;
  signingPassphrase?: string;
}): Promise<string> {
  const message = await openpgp.createMessage({ text: options.plaintext });

  let encryptionKeys: any[] = [];
  if (options.publicKeyArmored && options.publicKeyArmored.trim()) {
    const key = await openpgp.readKey({ armoredKey: options.publicKeyArmored.trim() });
    encryptionKeys.push(key);
  }

  let signingKeys: any[] = [];
  if (options.signingPrivateKeyArmored && options.signingPrivateKeyArmored.trim()) {
    let privKey = await openpgp.readPrivateKey({
      armoredKey: options.signingPrivateKeyArmored.trim(),
    });
    if (options.signingPassphrase) {
      privKey = await openpgp.decryptKey({
        privateKey: privKey,
        passphrase: options.signingPassphrase,
      });
    }
    signingKeys.push(privKey);
  }

  const ciphertext = await openpgp.encrypt({
    message,
    encryptionKeys: encryptionKeys.length > 0 ? encryptionKeys : undefined,
    passwords: options.passphrase ? [options.passphrase] : undefined,
    signingKeys: signingKeys.length > 0 ? signingKeys : undefined,
  });

  return ciphertext as string;
}

/**
 * Decrypt an OpenPGP Armored message using Private Key or Passphrase
 */
export async function decryptPgpMessage(options: {
  armoredCiphertext: string;
  privateKeyArmored?: string;
  passphrase?: string;
  verificationPublicKeyArmored?: string;
}): Promise<{
  data: string;
  signatures?: { keyID: string; verified: boolean }[];
}> {
  const message = await openpgp.readMessage({
    armoredMessage: options.armoredCiphertext.trim(),
  });

  let decryptionKeys: any[] = [];
  if (options.privateKeyArmored && options.privateKeyArmored.trim()) {
    let privKey = await openpgp.readPrivateKey({
      armoredKey: options.privateKeyArmored.trim(),
    });
    if (options.passphrase) {
      privKey = await openpgp.decryptKey({
        privateKey: privKey,
        passphrase: options.passphrase,
      });
    }
    decryptionKeys.push(privKey);
  }

  let verificationKeys: any[] = [];
  if (options.verificationPublicKeyArmored && options.verificationPublicKeyArmored.trim()) {
    const pubKey = await openpgp.readKey({
      armoredKey: options.verificationPublicKeyArmored.trim(),
    });
    verificationKeys.push(pubKey);
  }

  const { data: decrypted, signatures } = await openpgp.decrypt({
    message,
    decryptionKeys: decryptionKeys.length > 0 ? decryptionKeys : undefined,
    passwords: options.passphrase && decryptionKeys.length === 0 ? [options.passphrase] : undefined,
    verificationKeys: verificationKeys.length > 0 ? verificationKeys : undefined,
  });

  const verifiedSignatures: { keyID: string; verified: boolean }[] = [];
  if (signatures && signatures.length > 0) {
    for (const sig of signatures) {
      try {
        const verified = await sig.verified;
        verifiedSignatures.push({
          keyID: sig.keyID.toHex().toUpperCase(),
          verified,
        });
      } catch {
        verifiedSignatures.push({
          keyID: sig.keyID.toHex().toUpperCase(),
          verified: false,
        });
      }
    }
  }

  return {
    data: decrypted as string,
    signatures: verifiedSignatures,
  };
}

/**
 * Parse an OpenPGP key to get metadata (ID, user, algo)
 */
export async function getPgpKeyInfo(armoredKey: string): Promise<{
  keyID: string;
  fingerprint: string;
  userIDs: string[];
  algorithm: string;
  isPrivate: boolean;
}> {
  try {
    const isPrivate = armoredKey.includes('PRIVATE KEY BLOCK');
    const key = isPrivate
      ? await openpgp.readPrivateKey({ armoredKey: armoredKey.trim() })
      : await openpgp.readKey({ armoredKey: armoredKey.trim() });

    return {
      keyID: key.getKeyID().toHex().toUpperCase(),
      fingerprint: key.getFingerprint().toUpperCase(),
      userIDs: key.getUserIDs(),
      algorithm: key.getAlgorithmInfo().algorithm,
      isPrivate,
    };
  } catch (err: any) {
    throw new Error(`PGP鍵の解析に失敗しました: ${err.message}`);
  }
}

/**
 * Encrypt a file using OpenPGP
 */
export async function encryptPgpFile(options: {
  fileData: ArrayBuffer;
  fileName: string;
  publicKeyArmored?: string;
  passphrase?: string;
}): Promise<string> {
  const nameBytes = new TextEncoder().encode(options.fileName);
  const nameLen = nameBytes.length;
  const rawBytes = new Uint8Array(options.fileData);
  const payload = new Uint8Array(2 + nameLen + rawBytes.length);
  payload[0] = (nameLen >> 8) & 0xff;
  payload[1] = nameLen & 0xff;
  payload.set(nameBytes, 2);
  payload.set(rawBytes, 2 + nameLen);

  const message = await openpgp.createMessage({ binary: payload });
  let encryptionKeys: any[] = [];
  if (options.publicKeyArmored && options.publicKeyArmored.trim()) {
    const key = await openpgp.readKey({ armoredKey: options.publicKeyArmored.trim() });
    encryptionKeys.push(key);
  }

  const armored = await openpgp.encrypt({
    message,
    encryptionKeys: encryptionKeys.length > 0 ? encryptionKeys : undefined,
    passwords: options.passphrase ? [options.passphrase] : undefined,
    format: 'armored',
  });
  return armored as string;
}

/**
 * Decrypt an OpenPGP file
 */
export async function decryptPgpFile(options: {
  armoredOrBinary: string | ArrayBuffer;
  privateKeyArmored?: string;
  passphrase?: string;
}): Promise<{ fileName: string; fileData: ArrayBuffer }> {
  let message;
  if (typeof options.armoredOrBinary === 'string') {
    message = await openpgp.readMessage({ armoredMessage: options.armoredOrBinary.trim() });
  } else {
    message = await openpgp.readMessage({ binaryMessage: new Uint8Array(options.armoredOrBinary) });
  }

  let decryptionKeys: any[] = [];
  if (options.privateKeyArmored && options.privateKeyArmored.trim()) {
    let privKey = await openpgp.readPrivateKey({ armoredKey: options.privateKeyArmored.trim() });
    if (options.passphrase) {
      privKey = await openpgp.decryptKey({ privateKey: privKey, passphrase: options.passphrase });
    }
    decryptionKeys.push(privKey);
  }

  const { data: decrypted } = await openpgp.decrypt({
    message,
    decryptionKeys: decryptionKeys.length > 0 ? decryptionKeys : undefined,
    passwords: options.passphrase && decryptionKeys.length === 0 ? [options.passphrase] : undefined,
    format: 'binary',
  });

  const bytes = decrypted as Uint8Array;
  if (bytes.length >= 2) {
    const nameLen = (bytes[0] << 8) | bytes[1];
    if (bytes.length >= 2 + nameLen) {
      const fileName = new TextDecoder('utf-8').decode(bytes.subarray(2, 2 + nameLen));
      const fileData = bytes.subarray(2 + nameLen);
      const outBuffer = fileData.buffer.slice(
        fileData.byteOffset,
        fileData.byteOffset + fileData.byteLength
      ) as ArrayBuffer;
      return { fileName, fileData: outBuffer };
    }
  }

  const outBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return { fileName: 'decrypted.bin', fileData: outBuffer };
}
