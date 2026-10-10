export type KeyType = 'rsa-pss' | 'rsa-oaep' | 'rsa-pkcs1' | 'ecdsa' | 'ecdh' | 'aes-gcm';

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
  };
  publicKeyPem?: string;
  privateKeyPem?: string;
  rawKeyBase64?: string;
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
