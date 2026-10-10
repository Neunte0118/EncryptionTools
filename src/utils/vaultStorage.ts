import { KeyVaultFile, KeyVaultItem } from '../types/crypto';

const VAULT_STORAGE_KEY = 'local_crypto_vault_data';

export function createEmptyVault(name = 'ローカル暗号鍵管理ファイル'): KeyVaultFile {
  return {
    format: 'local-crypto-vault-v1',
    version: 1,
    vaultName: name,
    exportedAt: new Date().toISOString(),
    keys: [],
  };
}

export function loadVaultFromLocalStorage(): KeyVaultFile {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return createEmptyVault();
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.keys)) {
      return parsed as KeyVaultFile;
    }
  } catch (e) {
    console.error('Failed to parse vault from localStorage', e);
  }
  return createEmptyVault();
}

export function saveVaultToLocalStorage(vault: KeyVaultFile): void {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault, null, 2));
  } catch (e) {
    console.error('Failed to save vault to localStorage', e);
  }
}

export function parseVaultFile(jsonString: string): KeyVaultFile {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('JSONの構文解析に失敗しました。正しいJSONファイルを選択してください。');
  }

  // Handle both standard vault format and generic arrays
  if (parsed && Array.isArray(parsed.keys)) {
    return {
      format: 'local-crypto-vault-v1',
      version: 1,
      vaultName: parsed.vaultName || '読み込んだ鍵ファイル',
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      keys: parsed.keys.map((k: any) => normalizeKeyItem(k)),
    };
  }

  if (Array.isArray(parsed)) {
    return {
      format: 'local-crypto-vault-v1',
      version: 1,
      vaultName: 'インポートした鍵リスト',
      exportedAt: new Date().toISOString(),
      keys: parsed.map((k: any) => normalizeKeyItem(k)),
    };
  }

  throw new Error('未対応のファイル形式です。鍵リストを含むJSONファイルを指定してください。');
}

function normalizeKeyItem(k: any): KeyVaultItem {
  return {
    id: k.id || `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: k.title || '無題の鍵',
    memo: k.memo || '',
    type: k.type || 'rsa-oaep',
    algorithmDetails: k.algorithmDetails || { name: k.type || 'RSA' },
    publicKeyPem: k.publicKeyPem || undefined,
    privateKeyPem: k.privateKeyPem || undefined,
    rawKeyBase64: k.rawKeyBase64 || undefined,
    createdAt: k.createdAt || new Date().toISOString(),
    updatedAt: k.updatedAt || new Date().toISOString(),
  };
}

export function appendKeyToVault(
  vault: KeyVaultFile,
  item: Omit<KeyVaultItem, 'id' | 'createdAt' | 'updatedAt'>
): { updatedVault: KeyVaultFile; addedItem: KeyVaultItem } {
  const now = new Date().toISOString();
  const addedItem: KeyVaultItem = {
    ...item,
    id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };

  const updatedVault: KeyVaultFile = {
    ...vault,
    exportedAt: now,
    keys: [addedItem, ...vault.keys],
  };

  saveVaultToLocalStorage(updatedVault);
  return { updatedVault, addedItem };
}

export function deleteKeyFromVault(vault: KeyVaultFile, keyId: string): KeyVaultFile {
  const updatedVault: KeyVaultFile = {
    ...vault,
    exportedAt: new Date().toISOString(),
    keys: vault.keys.filter((k) => k.id !== keyId),
  };
  saveVaultToLocalStorage(updatedVault);
  return updatedVault;
}

export function updateKeyInVault(
  vault: KeyVaultFile,
  keyId: string,
  updates: Partial<Pick<KeyVaultItem, 'title' | 'memo' | 'publicKeyPem' | 'privateKeyPem'>>
): KeyVaultFile {
  const updatedVault: KeyVaultFile = {
    ...vault,
    exportedAt: new Date().toISOString(),
    keys: vault.keys.map((k) =>
      k.id === keyId
        ? {
            ...k,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
        : k
    ),
  };
  saveVaultToLocalStorage(updatedVault);
  return updatedVault;
}

export function exportVaultToFile(vault: KeyVaultFile, filename?: string): void {
  const exportData: KeyVaultFile = {
    ...vault,
    exportedAt: new Date().toISOString(),
  };
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `crypto_vault_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
