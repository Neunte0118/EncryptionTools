export type KeyType =
  | 'rsa-pss'
  | 'rsa-oaep'
  | 'rsa-pkcs1'
  | 'ecdsa'
  | 'ecdh'
  | 'ed25519'
  | 'x25519'
  | 'secp256k1'
  | 'aes-gcm'
  | 'aes-cbc'
  | 'aes-ctr'
  | 'aes-kw'
  | 'chacha20'
  | 'pqc-kem'
  | 'pqc-dsa'
  | 'pgp'
  | 'ring'
  | 'fhe'
  | 'abe-master'
  | 'abe-user'
  | 'passphrase'
  | 'hmac';

export interface KeyVaultItem {
  id: string;
  title: string;
  memo: string;
  type: KeyType;
  algorithmDetails: {
    name: string;
    modulusLength?: number;
    hash?: string;
    namedCurve?: string;
    length?: number;
    mode?: string;
    level?: string;
    attributes?: string[];
    [key: string]: any;
  };
  publicKeyPem?: string;
  privateKeyPem?: string;
  rawKeyBase64?: string;
  rawKeyHex?: string;
  armoredKey?: string;
  extraData?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface KeyVaultFile {
  format: 'local-crypto-vault-v1';
  version: 1;
  vaultName: string;
  exportedAt: string;
  keys: KeyVaultItem[];
}
