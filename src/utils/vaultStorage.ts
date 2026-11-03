import { KeyVaultFile, KeyVaultItem } from '../types/crypto';
import {
  encryptFileAesPassword,
  decryptFileAesPassword,
  isEncryptedFile,
  base64ToBuffer,
  bufferToBase64,
  bufferToString,
} from './cryptoUtils';
import { createEncryptedZip, extractEncryptedZip } from './zipUtils';

const VAULT_STORAGE_KEY = 'local_crypto_vault_data';

export interface EncryptedVaultPackage {
  format: 'local-crypto-vault-encrypted-v1';
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  exportedAt: string;
  hint?: string;
  keyCount: number;
}

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

export function normalizeKeyItem(k: any): KeyVaultItem {
  return {
    id: k.id || `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: k.title || '無題の鍵',
    memo: k.memo || '',
    type: k.type || 'rsa-oaep',
    algorithmDetails: k.algorithmDetails || { name: k.type || 'RSA' },
    publicKeyPem: k.publicKeyPem || undefined,
    privateKeyPem: k.privateKeyPem || undefined,
    rawKeyBase64: k.rawKeyBase64 || undefined,
    rawKeyHex: k.rawKeyHex || undefined,
    armoredKey: k.armoredKey || undefined,
    extraData: k.extraData || undefined,
    createdAt: k.createdAt || new Date().toISOString(),
    updatedAt: k.updatedAt || new Date().toISOString(),
  };
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

// --- Enhanced Vault Export Options ---

/**
 * Export vault as password-encrypted binary (.encvault)
 * Uses PBKDF2 (100,000 iter) + AES-256-GCM
 */
export async function exportEncryptedVault(
  vault: KeyVaultFile,
  password: string,
  hint?: string,
  selectedKeyIds?: string[]
): Promise<Blob> {
  const keysToExport = selectedKeyIds && selectedKeyIds.length > 0
    ? vault.keys.filter((k) => selectedKeyIds.includes(k.id))
    : vault.keys;

  const exportPayload: KeyVaultFile = {
    ...vault,
    vaultName: vault.vaultName || '暗号化鍵保管庫',
    exportedAt: new Date().toISOString(),
    keys: keysToExport,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const dataBuf = new TextEncoder().encode(jsonStr).buffer as ArrayBuffer;

  // Use standard LCV AES password encryption
  const encBuffer = await encryptFileAesPassword(
    dataBuf,
    hint ? `vault_hint_${encodeURIComponent(hint)}.json` : 'vault_backup.json',
    password
  );

  return new Blob([encBuffer], { type: 'application/octet-stream' });
}

/**
 * Export vault as plain JSON file (.json)
 */
export function exportJsonVault(
  vault: KeyVaultFile,
  options?: {
    selectedKeyIds?: string[];
    excludePrivateKeys?: boolean;
  }
): Blob {
  let keysToExport = options?.selectedKeyIds && options.selectedKeyIds.length > 0
    ? vault.keys.filter((k) => options.selectedKeyIds!.includes(k.id))
    : vault.keys;

  if (options?.excludePrivateKeys) {
    keysToExport = keysToExport.map((k) => {
      const copy = { ...k };
      delete copy.privateKeyPem;
      delete copy.rawKeyBase64;
      delete copy.rawKeyHex;
      return copy;
    });
  }

  const exportPayload: KeyVaultFile = {
    ...vault,
    exportedAt: new Date().toISOString(),
    keys: keysToExport,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
}

/**
 * Export vault as a ZIP archive of individual PEM / key files
 */
export async function exportVaultAsZip(
  vault: KeyVaultFile,
  options?: {
    selectedKeyIds?: string[];
    zipPassword?: string;
  }
): Promise<Blob> {
  const keysToExport = options?.selectedKeyIds && options.selectedKeyIds.length > 0
    ? vault.keys.filter((k) => options.selectedKeyIds!.includes(k.id))
    : vault.keys;

  const files: File[] = [];

  // Generate individual files for each key
  keysToExport.forEach((key, index) => {
    const safeTitle = (key.title || `key_${index + 1}`).replace(/[/\\?%*:|"<>]/g, '_');
    const folder = key.type.split('-')[0] || 'keys';

    if (key.privateKeyPem) {
      files.push(
        new File([key.privateKeyPem], `${folder}/${safeTitle}_private.pem`, {
          type: 'application/x-pem-file',
        })
      );
    }
    if (key.publicKeyPem) {
      files.push(
        new File([key.publicKeyPem], `${folder}/${safeTitle}_public.pem`, {
          type: 'application/x-pem-file',
        })
      );
    }
    if (key.rawKeyBase64 || key.rawKeyHex) {
      const content = `Base64: ${key.rawKeyBase64 || ''}\nHex: ${key.rawKeyHex || ''}\n`;
      files.push(
        new File([content], `${folder}/${safeTitle}_symmetric.key`, {
          type: 'text/plain',
        })
      );
    }
    if (key.armoredKey) {
      files.push(
        new File([key.armoredKey], `${folder}/${safeTitle}_armored.asc`, {
          type: 'text/plain',
        })
      );
    }

    // Key metadata json
    const metaJson = JSON.stringify(key, null, 2);
    files.push(
      new File([metaJson], `${folder}/${safeTitle}_meta.json`, {
        type: 'application/json',
      })
    );
  });

  // Include global vault manifest
  const manifest = JSON.stringify(
    {
      format: 'local-crypto-vault-zip-v1',
      vaultName: vault.vaultName,
      exportedAt: new Date().toISOString(),
      keyCount: keysToExport.length,
      keys: keysToExport.map((k) => ({
        id: k.id,
        title: k.title,
        type: k.type,
        algorithm: k.algorithmDetails?.name || k.type,
      })),
    },
    null,
    2
  );
  files.push(new File([manifest], 'manifest.json', { type: 'application/json' }));

  return await createEncryptedZip(files, {
    password: options?.zipPassword || undefined,
    encryptionStrength: options?.zipPassword ? 'aes-256' : undefined,
  });
}

/**
 * Save blob to disk
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportVaultToFile(vault: KeyVaultFile, filename?: string): void {
  const blob = exportJsonVault(vault);
  downloadBlob(blob, filename || `crypto_vault_${new Date().toISOString().slice(0, 10)}.json`);
}

// --- Enhanced Vault Import & Inspection ---

export type VaultFileType =
  | 'encrypted-vault'
  | 'plain-json-vault'
  | 'zip-archive'
  | 'raw-pem'
  | 'unknown';

export interface InspectedVaultFile {
  type: VaultFileType;
  isEncrypted: boolean;
  hint?: string;
  previewVault?: KeyVaultFile;
  candidateKeys?: KeyVaultItem[];
  error?: string;
}

/**
 * Inspect an uploaded file before importing to determine format, encryption, and keys
 */
export async function inspectImportFile(file: File): Promise<InspectedVaultFile> {
  const buffer = await file.arrayBuffer();

  // 1. Check if encrypted binary (LCV_ENC1)
  if (isEncryptedFile(buffer)) {
    let hint: string | undefined = undefined;
    try {
      const view = new DataView(buffer);
      const filenameLen = view.getUint16(8 + 1 + 16 + 12);
      const fnBytes = new Uint8Array(buffer, 8 + 1 + 16 + 12 + 2, filenameLen);
      const fn = new TextDecoder().decode(fnBytes);
      if (fn.startsWith('vault_hint_')) {
        hint = decodeURIComponent(fn.replace('vault_hint_', '').replace('.json', ''));
      }
    } catch {}

    return {
      type: 'encrypted-vault',
      isEncrypted: true,
      hint,
    };
  }

  // 2. Check if ZIP archive (PK header)
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
    return {
      type: 'zip-archive',
      isEncrypted: false,
    };
  }

  // 3. Check Text formats
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    const trimmed = text.trim();

    // Check JSON encrypted wrapper
    if (trimmed.startsWith('{') && trimmed.includes('"format":"local-crypto-vault-encrypted-v1"')) {
      try {
        const pkg: EncryptedVaultPackage = JSON.parse(trimmed);
        return {
          type: 'encrypted-vault',
          isEncrypted: true,
          hint: pkg.hint,
        };
      } catch {}
    }

    // Check Plain JSON Vault
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsedVault = parseVaultFile(trimmed);
        return {
          type: 'plain-json-vault',
          isEncrypted: false,
          previewVault: parsedVault,
          candidateKeys: parsedVault.keys,
        };
      } catch (err: any) {
        // Not a standard vault json, continue checking
      }
    }

    // Check Single PEM file
    if (
      trimmed.includes('-----BEGIN PRIVATE KEY-----') ||
      trimmed.includes('-----BEGIN RSA PRIVATE KEY-----') ||
      trimmed.includes('-----BEGIN PUBLIC KEY-----') ||
      trimmed.includes('-----BEGIN RSA PUBLIC KEY-----') ||
      trimmed.includes('-----BEGIN EC PRIVATE KEY-----') ||
      trimmed.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----') ||
      trimmed.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')
    ) {
      const isPriv = trimmed.includes('PRIVATE KEY');
      const isPgp = trimmed.includes('PGP');
      const item: KeyVaultItem = {
        id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        memo: `インポート元ファイル: ${file.name}`,
        type: isPgp ? 'pgp' : isPriv ? 'rsa-oaep' : 'rsa-oaep',
        algorithmDetails: { name: isPgp ? 'OpenPGP' : 'RSA' },
        publicKeyPem: !isPriv && !isPgp ? trimmed : undefined,
        privateKeyPem: isPriv && !isPgp ? trimmed : undefined,
        armoredKey: isPgp ? trimmed : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        type: 'raw-pem',
        isEncrypted: false,
        candidateKeys: [item],
      };
    }
  } catch {}

  return {
    type: 'unknown',
    isEncrypted: false,
    error: '対応していないファイル形式です。.json, .encvault, .zip, または .pem を選択してください。',
  };
}

/**
 * Decrypt an encrypted vault file with the given password
 */
export async function decryptImportFile(file: File, password: string): Promise<KeyVaultFile> {
  const buffer = await file.arrayBuffer();

  // Try binary decryption first
  if (isEncryptedFile(buffer)) {
    try {
      const decrypted = await decryptFileAesPassword(buffer, password);
      const jsonStr = new TextDecoder('utf-8').decode(decrypted.fileData);
      return parseVaultFile(jsonStr);
    } catch (err: any) {
      throw new Error(`復号に失敗しました: パスワードが間違っているか、ファイルが破損しています (${err.message})`);
    }
  }

  // Try ZIP extraction
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B) {
    try {
      const extracted = await extractEncryptedZip(file, password || undefined);
      const manifestEntry = extracted.find((e) => e.filename.endsWith('manifest.json'));
      if (manifestEntry) {
        const manifestText = await manifestEntry.data.text();
        // Check if full keys are in manifest or individual files
        try {
          const m = JSON.parse(manifestText);
          if (m.keys && Array.isArray(m.keys)) {
            // Check meta json files
            const keys: KeyVaultItem[] = [];
            for (const item of extracted) {
              if (item.filename.endsWith('_meta.json')) {
                try {
                  const meta = JSON.parse(await item.data.text());
                  keys.push(normalizeKeyItem(meta));
                } catch {}
              }
            }
            if (keys.length > 0) {
              return {
                format: 'local-crypto-vault-v1',
                version: 1,
                vaultName: m.vaultName || file.name,
                exportedAt: m.exportedAt || new Date().toISOString(),
                keys,
              };
            }
          }
        } catch {}
      }

      // If no manifest, extract any PEMs
      const pemKeys: KeyVaultItem[] = [];
      for (const item of extracted) {
        if (item.filename.endsWith('.pem') || item.filename.endsWith('.asc') || item.filename.endsWith('.key')) {
          const txt = await item.data.text();
          const isPriv = txt.includes('PRIVATE KEY');
          const isPgp = txt.includes('PGP');
          pemKeys.push({
            id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: item.filename.replace(/^.*[\\/]/, '').replace(/\.[^/.]+$/, ''),
            memo: `ZIP内ファイル: ${item.filename}`,
            type: isPgp ? 'pgp' : 'rsa-oaep',
            algorithmDetails: { name: isPgp ? 'OpenPGP' : 'RSA' },
            publicKeyPem: !isPriv && !isPgp ? txt : undefined,
            privateKeyPem: isPriv && !isPgp ? txt : undefined,
            armoredKey: isPgp ? txt : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      if (pemKeys.length > 0) {
        return {
          format: 'local-crypto-vault-v1',
          version: 1,
          vaultName: `ZIP展開 (${file.name})`,
          exportedAt: new Date().toISOString(),
          keys: pemKeys,
        };
      }
      throw new Error('ZIPアーカイブ内に鍵ファイルが見つかりませんでした');
    } catch (err: any) {
      throw new Error(`ZIP解凍または復号に失敗しました: ${err.message}`);
    }
  }

  throw new Error('未対応の暗号化フォーマットです');
}

/**
 * Merge or Overwrite keys into the current vault
 */
export function mergeVaultKeys(
  currentVault: KeyVaultFile,
  incomingKeys: KeyVaultItem[],
  mode: 'merge' | 'overwrite'
): { updatedVault: KeyVaultFile; addedCount: number; duplicateCount: number } {
  if (mode === 'overwrite') {
    const updatedVault: KeyVaultFile = {
      ...currentVault,
      exportedAt: new Date().toISOString(),
      keys: incomingKeys.map((k) => normalizeKeyItem(k)),
    };
    saveVaultToLocalStorage(updatedVault);
    return {
      updatedVault,
      addedCount: incomingKeys.length,
      duplicateCount: 0,
    };
  }

  // Merge Mode: detect duplicates by ID or by exact matching key material
  const existingKeyIds = new Set(currentVault.keys.map((k) => k.id));
  const existingPems = new Set(
    currentVault.keys
      .map((k) => k.privateKeyPem || k.publicKeyPem || k.rawKeyBase64 || '')
      .filter(Boolean)
  );

  const keysToAdd: KeyVaultItem[] = [];
  let duplicateCount = 0;

  for (const inc of incomingKeys) {
    const pemSignature = inc.privateKeyPem || inc.publicKeyPem || inc.rawKeyBase64 || '';
    if (pemSignature && existingPems.has(pemSignature)) {
      duplicateCount++;
      continue;
    }

    let finalId = inc.id;
    if (existingKeyIds.has(finalId)) {
      finalId = `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    const newItem: KeyVaultItem = {
      ...normalizeKeyItem(inc),
      id: finalId,
      updatedAt: new Date().toISOString(),
    };

    keysToAdd.push(newItem);
    existingKeyIds.add(finalId);
    if (pemSignature) existingPems.add(pemSignature);
  }

  const updatedVault: KeyVaultFile = {
    ...currentVault,
    exportedAt: new Date().toISOString(),
    keys: [...keysToAdd, ...currentVault.keys],
  };

  saveVaultToLocalStorage(updatedVault);

  return {
    updatedVault,
    addedCount: keysToAdd.length,
    duplicateCount,
  };
}
