import React, { useState } from 'react';
import {
  KeyGenOptions,
  GeneratedKeyResult,
  generateKeyPairOrKey,
  HashAlgorithm,
  bufferToBase64,
  bufferToHex,
} from '../utils/cryptoUtils';
import {
  generateEd25519KeyPair,
  generateX25519KeyPair,
  generateSecp256k1KeyPair,
} from '../utils/curveUtils';
import {
  generateMlKemKeyPair,
  generateMlDsaKeyPair,
  MlKemLevel,
  MlDsaLevel,
} from '../utils/postQuantumUtils';
import { generatePgpKeyPair } from '../utils/pgpUtils';
import { generateRingKeyPair } from '../utils/ringSignatureUtils';
import {
  generatePaillierKeys,
  serializePaillierPublicKey,
  serializePaillierPrivateKey,
} from '../utils/fheUtils';
import {
  generateMasterAuthority,
  issueUserKey,
  serializeMasterAuthority,
  serializeUserSecretKey,
} from '../utils/abeUtils';
import { KeyVaultFile, KeyVaultItem, KeyType } from '../types/crypto';
import { appendKeyToVault } from '../utils/vaultStorage';
import { Tab } from '../App';
import {
  Key,
  Download,
  Copy,
  Check,
  PlusCircle,
  Shield,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Atom,
  Lock,
  Cpu,
  Tag,
  Users,
  Dices,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  vault: KeyVaultFile;
  onVaultChange: (updated: KeyVaultFile) => void;
  onNavigateToVault?: () => void;
  onSelectTab?: (tab: Tab) => void;
  onSelectKeyForAction?: (
    action: 'sign' | 'verify' | 'encrypt' | 'decrypt',
    key: KeyVaultItem
  ) => void;
}

export type MasterKeyCategory =
  | 'public-key'
  | 'symmetric'
  | 'post-quantum'
  | 'specialized'
  | 'passphrase';

export const KeyGeneratorTool: React.FC<Props> = ({
  vault,
  onVaultChange,
  onNavigateToVault,
  onSelectTab,
  onSelectKeyForAction,
}) => {
  const [category, setCategory] = useState<MasterKeyCategory>('public-key');
  const [keyType, setKeyType] = useState<KeyType>('rsa-oaep');

  // RSA options
  const [modulusLength, setModulusLength] = useState<number>(2048);
  const [hash, setHash] = useState<HashAlgorithm>('SHA-256');

  // ECC options
  const [namedCurve, setNamedCurve] = useState<'P-256' | 'P-384' | 'P-521'>('P-256');

  // Symmetric options
  const [aesLength, setAesLength] = useState<128 | 192 | 256>(256);
  const [hmacLength, setHmacLength] = useState<128 | 256 | 512>(256);

  // PQC options
  const [kemLevel, setKemLevel] = useState<MlKemLevel>('768');
  const [dsaLevel, setDsaLevel] = useState<MlDsaLevel>('65');

  // OpenPGP options
  const [pgpName, setPgpName] = useState('Alice');
  const [pgpEmail, setPgpEmail] = useState('alice@example.com');
  const [pgpPassphrase, setPgpPassphrase] = useState('');
  const [pgpType, setPgpType] = useState<'ecc' | 'rsa'>('ecc');
  const [pgpRsaBits, setPgpRsaBits] = useState<2048 | 4096>(2048);

  // ABE options
  const [abeUserId, setAbeUserId] = useState('user01');
  const [abeAttributes, setAbeAttributes] = useState('dept:engineering, level:3, role:lead');

  // FHE options
  const [fheKeyBits, setFheKeyBits] = useState<number>(1024);

  // Passphrase options
  const [passLength, setPassLength] = useState(32);
  const [passIncludeUpper, setPassIncludeUpper] = useState(true);
  const [passIncludeLower, setPassIncludeLower] = useState(true);
  const [passIncludeDigits, setPassIncludeDigits] = useState(true);
  const [passIncludeSymbols, setPassIncludeSymbols] = useState(true);

  // State for result
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKeyItem, setGeneratedKeyItem] = useState<{
    type: KeyType;
    title: string;
    memo: string;
    algorithmDetails: { name: string; [key: string]: any };
    publicKeyPem?: string;
    privateKeyPem?: string;
    rawKeyBase64?: string;
    rawKeyHex?: string;
    armoredKey?: string;
    extraData?: Record<string, any>;
  } | null>(null);

  const [isPrivateKeyRevealed, setIsPrivateKeyRevealed] = useState(false);
  const [appendTitle, setAppendTitle] = useState('');
  const [appendMemo, setAppendMemo] = useState('');
  const [appendSuccess, setAppendSuccess] = useState(false);
  const [lastSavedKeyItem, setLastSavedKeyItem] = useState<KeyVaultItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Helper for random password
  const generateRandomPassphrase = (): string => {
    let charset = '';
    if (passIncludeUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (passIncludeLower) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (passIncludeDigits) charset += '0123456789';
    if (passIncludeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!charset) charset = 'abcdefghijklmnopqrstuvwxyz0123456789';

    const array = new Uint32Array(passLength);
    window.crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < passLength; i++) {
      result += charset[array[i] % charset.length];
    }
    return result;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setAppendSuccess(false);
    setIsPrivateKeyRevealed(false);
    setLastSavedKeyItem(null);

    try {
      const today = new Date().toLocaleDateString('ja-JP');

      if (keyType === 'rsa-oaep' || keyType === 'rsa-pss' || keyType === 'rsa-pkcs1') {
        const res = await generateKeyPairOrKey({
          type: keyType,
          modulusLength,
          hash,
        });
        const typeLabel =
          keyType === 'rsa-oaep'
            ? `RSA-OAEP ${modulusLength}bit (${hash})`
            : keyType === 'rsa-pss'
            ? `RSA-PSS ${modulusLength}bit (${hash})`
            : `RSASSA-PKCS1 ${modulusLength}bit (${hash})`;

        setGeneratedKeyItem({
          type: keyType,
          title: typeLabel,
          memo: `生成日: ${today} / モジュラス: ${modulusLength}bit, ハッシュ: ${hash}`,
          algorithmDetails: {
            name: keyType.toUpperCase(),
            modulusLength,
            hash,
          },
          publicKeyPem: res.publicKeyPem,
          privateKeyPem: res.privateKeyPem,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'ecdsa' || keyType === 'ecdh') {
        const res = await generateKeyPairOrKey({
          type: keyType,
          namedCurve,
        });
        const typeLabel = `${keyType.toUpperCase()} (${namedCurve})`;
        setGeneratedKeyItem({
          type: keyType,
          title: typeLabel,
          memo: `生成日: ${today} / 曲線: ${namedCurve}`,
          algorithmDetails: {
            name: keyType.toUpperCase(),
            namedCurve,
          },
          publicKeyPem: res.publicKeyPem,
          privateKeyPem: res.privateKeyPem,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'ed25519') {
        const kp = generateEd25519KeyPair();
        const typeLabel = 'Ed25519 高速署名鍵ペア';
        setGeneratedKeyItem({
          type: 'ed25519',
          title: typeLabel,
          memo: `生成日: ${today} / Curve25519 EdDSA`,
          algorithmDetails: { name: 'Ed25519', curve: 'Ed25519' },
          publicKeyPem: kp.publicKeyHex,
          privateKeyPem: kp.privateKeyHex,
          rawKeyHex: kp.publicKeyHex,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'x25519') {
        const kp = generateX25519KeyPair();
        const typeLabel = 'X25519 鍵共有鍵ペア';
        setGeneratedKeyItem({
          type: 'x25519',
          title: typeLabel,
          memo: `生成日: ${today} / Curve25519 Diffie-Hellman`,
          algorithmDetails: { name: 'X25519', curve: 'Curve25519' },
          publicKeyPem: kp.publicKeyHex,
          privateKeyPem: kp.privateKeyHex,
          rawKeyHex: kp.publicKeyHex,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'secp256k1') {
        const kp = generateSecp256k1KeyPair();
        const typeLabel = 'secp256k1 (Bitcoin/Ethereum) 鍵ペア';
        setGeneratedKeyItem({
          type: 'secp256k1',
          title: typeLabel,
          memo: `生成日: ${today} / Koblitz curve`,
          algorithmDetails: { name: 'secp256k1', curve: 'secp256k1' },
          publicKeyPem: kp.publicKeyHex,
          privateKeyPem: kp.privateKeyHex,
          rawKeyHex: kp.publicKeyHex,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'aes-gcm' || keyType === 'aes-cbc' || keyType === 'aes-ctr') {
        const bytes = new Uint8Array(aesLength / 8);
        window.crypto.getRandomValues(bytes);
        const b64 = bufferToBase64(bytes.buffer as ArrayBuffer);
        const hex = bufferToHex(bytes.buffer as ArrayBuffer);
        const modeLabel = keyType.toUpperCase();
        const typeLabel = `${modeLabel} ${aesLength}bit 共通鍵`;

        setGeneratedKeyItem({
          type: keyType,
          title: typeLabel,
          memo: `生成日: ${today} / 暗号論的擬似乱数 (CSPRNG) による ${aesLength}bit 共通鍵`,
          algorithmDetails: { name: modeLabel, length: aesLength, mode: modeLabel },
          rawKeyBase64: b64,
          rawKeyHex: hex,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'chacha20') {
        const bytes = new Uint8Array(32); // 256 bits
        window.crypto.getRandomValues(bytes);
        const b64 = bufferToBase64(bytes.buffer as ArrayBuffer);
        const hex = bufferToHex(bytes.buffer as ArrayBuffer);
        const typeLabel = 'ChaCha20 / XChaCha20 256bit 共通鍵';

        setGeneratedKeyItem({
          type: 'chacha20',
          title: typeLabel,
          memo: `生成日: ${today} / RFC 8439 256bit (32 bytes) 対称鍵`,
          algorithmDetails: { name: 'CHACHA20', length: 256 },
          rawKeyBase64: b64,
          rawKeyHex: hex,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'hmac') {
        const bytes = new Uint8Array(hmacLength / 8);
        window.crypto.getRandomValues(bytes);
        const b64 = bufferToBase64(bytes.buffer as ArrayBuffer);
        const hex = bufferToHex(bytes.buffer as ArrayBuffer);
        const typeLabel = `HMAC ${hmacLength}bit 認証キー`;

        setGeneratedKeyItem({
          type: 'hmac',
          title: typeLabel,
          memo: `生成日: ${today} / HMAC 認証キー ${hmacLength}bit`,
          algorithmDetails: { name: 'HMAC', length: hmacLength },
          rawKeyBase64: b64,
          rawKeyHex: hex,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'pqc-kem') {
        const keys = generateMlKemKeyPair(kemLevel);
        const typeLabel = `ML-KEM-${kemLevel} (Kyber) 耐量子鍵ペア`;
        setGeneratedKeyItem({
          type: 'pqc-kem',
          title: typeLabel,
          memo: `生成日: ${today} / NIST FIPS 203 Level ${kemLevel}`,
          algorithmDetails: { name: 'ML-KEM', level: kemLevel },
          publicKeyPem: keys.publicKeyHex,
          privateKeyPem: keys.secretKeyHex,
          extraData: { level: kemLevel, format: 'hex' },
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'pqc-dsa') {
        const keys = generateMlDsaKeyPair(dsaLevel);
        const typeLabel = `ML-DSA-${dsaLevel} (Dilithium) 耐量子署名鍵ペア`;
        setGeneratedKeyItem({
          type: 'pqc-dsa',
          title: typeLabel,
          memo: `生成日: ${today} / NIST FIPS 204 Level ${dsaLevel}`,
          algorithmDetails: { name: 'ML-DSA', level: dsaLevel },
          publicKeyPem: keys.publicKeyHex,
          privateKeyPem: keys.secretKeyHex,
          extraData: { level: dsaLevel, format: 'hex' },
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'pgp') {
        const pgpResult = await generatePgpKeyPair({
          name: pgpName.trim() || 'Anonymous',
          email: pgpEmail.trim() || 'anon@example.com',
          passphrase: pgpPassphrase.trim() || undefined,
          type: pgpType,
          rsaBits: pgpRsaBits,
        });
        const typeLabel = `OpenPGP (${pgpType === 'ecc' ? 'Curve25519' : `RSA ${pgpRsaBits}`}) - ${pgpName}`;
        setGeneratedKeyItem({
          type: 'pgp',
          title: typeLabel,
          memo: `生成日: ${today} / Email: ${pgpEmail} / ID: ${pgpResult.keyID || 'N/A'}`,
          algorithmDetails: {
            name: 'OpenPGP',
            type: pgpType,
            rsaBits: pgpType === 'rsa' ? pgpRsaBits : undefined,
            keyId: pgpResult.keyID,
            fingerprint: pgpResult.fingerprint,
          },
          publicKeyPem: pgpResult.publicKeyArmored,
          privateKeyPem: pgpResult.privateKeyArmored,
          armoredKey: pgpResult.publicKeyArmored,
          extraData: {
            keyId: pgpResult.keyID,
            fingerprint: pgpResult.fingerprint,
          },
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'ring') {
        const ringKey = generateRingKeyPair('リング署名者鍵');
        const typeLabel = 'リング署名 Ed25519 鍵ペア';
        setGeneratedKeyItem({
          type: 'ring',
          title: typeLabel,
          memo: `生成日: ${today} / 匿名リング署名用`,
          algorithmDetails: { name: 'RingSignature-Ed25519' },
          publicKeyPem: ringKey.publicKeyHex,
          privateKeyPem: ringKey.secretKeyHex,
          rawKeyHex: ringKey.publicKeyHex,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'fhe') {
        const fheKeys = generatePaillierKeys();
        const pubJson = serializePaillierPublicKey(fheKeys.publicKey);
        const privJson = serializePaillierPrivateKey(fheKeys.privateKey);
        const typeLabel = `完全準同型暗号 (Paillier 256bit) 鍵ペア`;
        setGeneratedKeyItem({
          type: 'fhe',
          title: typeLabel,
          memo: `生成日: ${today} / 加法完全準同型暗号 (HE)`,
          algorithmDetails: { name: 'Paillier-FHE', bits: 256 },
          publicKeyPem: JSON.stringify(pubJson, null, 2),
          privateKeyPem: JSON.stringify(privJson, null, 2),
          extraData: { pubJson, privJson },
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'abe-master') {
        const auth = generateMasterAuthority();
        const jsonStr = JSON.stringify(serializeMasterAuthority(auth), null, 2);
        const typeLabel = '属性ベース暗号 (CP-ABE) マスター機関鍵';
        setGeneratedKeyItem({
          type: 'abe-master',
          title: typeLabel,
          memo: `生成日: ${today} / ABE Authority ID: ${auth.publicParamsId}`,
          algorithmDetails: { name: 'CP-ABE-Master', authorityId: auth.publicParamsId },
          publicKeyPem: auth.publicParamsId,
          privateKeyPem: jsonStr,
          extraData: { authority: auth },
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'abe-user') {
        // Generate on-the-fly master authority and user key
        const auth = generateMasterAuthority();
        const attrList = abeAttributes.split(',').map((s) => s.trim()).filter(Boolean);
        const userKey = issueUserKey(auth, abeUserId.trim() || 'user', attrList);
        const userKeyJson = JSON.stringify(serializeUserSecretKey(userKey), null, 2);
        const typeLabel = `CP-ABE 属性秘密鍵 (${abeUserId})`;
        setGeneratedKeyItem({
          type: 'abe-user',
          title: typeLabel,
          memo: `生成日: ${today} / ユーザー: ${abeUserId} / 属性: ${attrList.join(', ')}`,
          algorithmDetails: {
            name: 'CP-ABE-UserKey',
            userId: abeUserId,
            attributes: attrList,
          },
          privateKeyPem: userKeyJson,
          extraData: { userKey },
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      } else if (keyType === 'passphrase') {
        const pass = generateRandomPassphrase();
        const typeLabel = `暗号論的ランダムパスフレーズ (${passLength}文字)`;
        setGeneratedKeyItem({
          type: 'passphrase',
          title: typeLabel,
          memo: `生成日: ${today} / エントロピー: 約${Math.round(passLength * 5.95)} bit`,
          algorithmDetails: { name: 'Passphrase', length: passLength },
          rawKeyBase64: pass,
        });
        setAppendTitle(typeLabel);
        setAppendMemo(`生成日: ${today}`);
      }
    } catch (e: any) {
      alert(`鍵の生成に失敗しました: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAppendToVault = () => {
    if (!generatedKeyItem) return;
    if (!appendTitle.trim()) {
      alert('鍵のタイトルを入力してください');
      return;
    }

    const { updatedVault, addedItem } = appendKeyToVault(vault, {
      title: appendTitle.trim(),
      memo: appendMemo.trim(),
      type: generatedKeyItem.type,
      algorithmDetails: generatedKeyItem.algorithmDetails,
      publicKeyPem: generatedKeyItem.publicKeyPem,
      privateKeyPem: generatedKeyItem.privateKeyPem,
      rawKeyBase64: generatedKeyItem.rawKeyBase64,
      rawKeyHex: generatedKeyItem.rawKeyHex,
      armoredKey: generatedKeyItem.armoredKey,
      extraData: generatedKeyItem.extraData,
    });

    onVaultChange(updatedVault);
    setLastSavedKeyItem(addedItem);
    setAppendSuccess(true);
    setTimeout(() => setAppendSuccess(false), 5000);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleQuickUse = (targetTab: Tab) => {
    if (!generatedKeyItem) return;
    // If not yet appended to vault, append automatically
    let keyToUse: KeyVaultItem = lastSavedKeyItem || {
      id: `key_${Date.now()}`,
      title: appendTitle.trim() || generatedKeyItem.title,
      memo: appendMemo.trim() || generatedKeyItem.memo,
      type: generatedKeyItem.type,
      algorithmDetails: generatedKeyItem.algorithmDetails,
      publicKeyPem: generatedKeyItem.publicKeyPem,
      privateKeyPem: generatedKeyItem.privateKeyPem,
      rawKeyBase64: generatedKeyItem.rawKeyBase64,
      rawKeyHex: generatedKeyItem.rawKeyHex,
      armoredKey: generatedKeyItem.armoredKey,
      extraData: generatedKeyItem.extraData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!lastSavedKeyItem) {
      const { updatedVault, addedItem } = appendKeyToVault(vault, {
        title: appendTitle.trim() || generatedKeyItem.title,
        memo: appendMemo.trim() || generatedKeyItem.memo,
        type: generatedKeyItem.type,
        algorithmDetails: generatedKeyItem.algorithmDetails,
        publicKeyPem: generatedKeyItem.publicKeyPem,
        privateKeyPem: generatedKeyItem.privateKeyPem,
        rawKeyBase64: generatedKeyItem.rawKeyBase64,
        rawKeyHex: generatedKeyItem.rawKeyHex,
        armoredKey: generatedKeyItem.armoredKey,
        extraData: generatedKeyItem.extraData,
      });
      onVaultChange(updatedVault);
      keyToUse = addedItem;
    }

    if (onSelectKeyForAction) {
      if (targetTab === 'aes' || targetTab === 'rsa' || targetTab === 'chacha') {
        onSelectKeyForAction('encrypt', keyToUse);
      } else if (targetTab === 'signatures') {
        onSelectKeyForAction('sign', keyToUse);
      } else if (targetTab === 'ecdh') {
        onSelectKeyForAction('encrypt', keyToUse);
      }
    }

    if (onSelectTab) {
      onSelectTab(targetTab);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Unified Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">暗号鍵生成</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-medium">
                中央統合キー生成
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              RSA、ECC、耐量子暗号、共通鍵、OpenPGP、リング署名、準同型暗号など全ての鍵をここで生成します
            </p>
          </div>
        </div>

        {/* Category Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setCategory('public-key');
              setKeyType('rsa-oaep');
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              category === 'public-key'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            公開鍵暗号 (RSA/ECC)
          </button>
          <button
            type="button"
            onClick={() => {
              setCategory('symmetric');
              setKeyType('aes-gcm');
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              category === 'symmetric'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            共通鍵 (AES/ChaCha)
          </button>
          <button
            type="button"
            onClick={() => {
              setCategory('post-quantum');
              setKeyType('pqc-kem');
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              category === 'post-quantum'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            耐量子暗号 (PQC)
          </button>
          <button
            type="button"
            onClick={() => {
              setCategory('specialized');
              setKeyType('pgp');
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              category === 'specialized'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PGP / FHE / ABE
          </button>
          <button
            type="button"
            onClick={() => {
              setCategory('passphrase');
              setKeyType('passphrase');
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              category === 'passphrase'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            パスフレーズ
          </button>
        </div>
      </div>

      {/* Parameter Selection Form Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            暗号化方式・アルゴリズム選択
          </label>
          <select
            value={keyType}
            onChange={(e) => setKeyType(e.target.value as KeyType)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
          >
            {category === 'public-key' && (
              <>
                <optgroup label="RSA (Rivest-Shamir-Adleman)">
                  <option value="rsa-oaep">RSA-OAEP (公開鍵暗号・暗号化用)</option>
                  <option value="rsa-pss">RSA-PSS (電子署名用)</option>
                  <option value="rsa-pkcs1">RSASSA-PKCS1-v1_5 (レガシー電子署名)</option>
                </optgroup>
                <optgroup label="楕円曲線暗号 (NIST曲線)">
                  <option value="ecdsa">ECDSA (P-256 / P-384 / P-521 署名用)</option>
                  <option value="ecdh">ECDH (P-256 / P-384 / P-521 鍵共有用)</option>
                </optgroup>
                <optgroup label="現代的楕円曲線 (Edwards / Montgomery / Koblitz)">
                  <option value="ed25519">Ed25519 (Edwards曲線 高速・高安全性署名)</option>
                  <option value="x25519">X25519 (Curve25519 Diffie-Hellman 鍵共有)</option>
                  <option value="secp256k1">secp256k1 (Bitcoin / Ethereum 署名・鍵共有)</option>
                </optgroup>
              </>
            )}

            {category === 'symmetric' && (
              <>
                <optgroup label="AES (Advanced Encryption Standard - FIPS 197)">
                  <option value="aes-gcm">AES-GCM (Galois/Counter Mode - AEAD認証暗号)</option>
                  <option value="aes-cbc">AES-CBC (Cipher Block Chaining - ブロック暗号)</option>
                  <option value="aes-ctr">AES-CTR (Counter Mode - ストリーム型)</option>
                </optgroup>
                <optgroup label="ChaCha20 / Salsa20">
                  <option value="chacha20">ChaCha20 256bit 共通鍵 (RFC 8439)</option>
                </optgroup>
                <optgroup label="HMAC メッセージ認証符号">
                  <option value="hmac">HMAC 共有シークレットキー</option>
                </optgroup>
              </>
            )}

            {category === 'post-quantum' && (
              <>
                <optgroup label="NIST耐量子暗号標準 (PQC)">
                  <option value="pqc-kem">ML-KEM (Kyber - NIST FIPS 203 鍵カプセル化・耐量子暗号)</option>
                  <option value="pqc-dsa">ML-DSA (Dilithium - NIST FIPS 204 耐量子デジタル署名)</option>
                </optgroup>
              </>
            )}

            {category === 'specialized' && (
              <>
                <optgroup label="OpenPGP (RFC 4880)">
                  <option value="pgp">OpenPGP 鍵ペア (ECC Curve25519 / RSA)</option>
                </optgroup>
                <optgroup label="先端暗号理論">
                  <option value="ring">リング署名鍵ペア (Ed25519 匿名署名)</option>
                  <option value="fhe">完全準同型暗号 Paillier 鍵ペア (暗号化状態での集計計算)</option>
                  <option value="abe-master">属性ベース暗号 (CP-ABE) マスター機関鍵</option>
                  <option value="abe-user">属性ベース暗号 (CP-ABE) ユーザー属性鍵</option>
                </optgroup>
              </>
            )}

            {category === 'passphrase' && (
              <option value="passphrase">高エントロピー暗号論的ランダムパスフレーズ</option>
            )}
          </select>
        </div>

        {/* Dynamic Detail Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
          {keyType.startsWith('rsa') && (
            <>
              <div>
                <label className="block text-slate-400 mb-1">モジュラス鍵長</label>
                <select
                  value={modulusLength}
                  onChange={(e) => setModulusLength(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value={2048}>2048 bit (標準)</option>
                  <option value={3072}>3072 bit (高セキュリティ)</option>
                  <option value={4096}>4096 bit (最高強度)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">ダイジェスト・ハッシュ関数</label>
                <select
                  value={hash}
                  onChange={(e) => setHash(e.target.value as HashAlgorithm)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="SHA-256">SHA-256 (推奨)</option>
                  <option value="SHA-384">SHA-384</option>
                  <option value="SHA-512">SHA-512</option>
                  {keyType === 'rsa-oaep' && <option value="SHA-1">SHA-1 (互換性用)</option>}
                </select>
              </div>
            </>
          )}

          {(keyType === 'ecdsa' || keyType === 'ecdh') && (
            <div>
              <label className="block text-slate-400 mb-1">定義済み楕円曲線 (Named Curve)</label>
              <select
                value={namedCurve}
                onChange={(e) => setNamedCurve(e.target.value as 'P-256' | 'P-384' | 'P-521')}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="P-256">NIST P-256 (secp256r1 - 128bit 安全性)</option>
                <option value="P-384">NIST P-384 (secp384r1 - 192bit 安全性)</option>
                <option value="P-521">NIST P-521 (secp521r1 - 256bit 最高強度)</option>
              </select>
            </div>
          )}

          {(keyType === 'aes-gcm' || keyType === 'aes-cbc' || keyType === 'aes-ctr') && (
            <div>
              <label className="block text-slate-400 mb-1">AES 鍵長</label>
              <select
                value={aesLength}
                onChange={(e) => setAesLength(Number(e.target.value) as 128 | 192 | 256)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value={256}>256 bit (32バイト - 最高強度)</option>
                <option value={192}>192 bit (24バイト)</option>
                <option value={128}>128 bit (16バイト)</option>
              </select>
            </div>
          )}

          {keyType === 'hmac' && (
            <div>
              <label className="block text-slate-400 mb-1">HMAC 鍵長</label>
              <select
                value={hmacLength}
                onChange={(e) => setHmacLength(Number(e.target.value) as 128 | 256 | 512)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value={256}>256 bit (SHA-256推奨)</option>
                <option value={512}>512 bit (SHA-512推奨)</option>
                <option value={128}>128 bit</option>
              </select>
            </div>
          )}

          {keyType === 'pqc-kem' && (
            <div>
              <label className="block text-slate-400 mb-1">ML-KEM セキュリティレベル</label>
              <select
                value={kemLevel}
                onChange={(e) => setKemLevel(e.target.value as MlKemLevel)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="512">ML-KEM-512 (NIST Category 1 / AES-128同等)</option>
                <option value="768">ML-KEM-768 (NIST Category 3 / AES-192同等 - 推奨)</option>
                <option value="1024">ML-KEM-1024 (NIST Category 5 / AES-256同等)</option>
              </select>
            </div>
          )}

          {keyType === 'pqc-dsa' && (
            <div>
              <label className="block text-slate-400 mb-1">ML-DSA セキュリティレベル</label>
              <select
                value={dsaLevel}
                onChange={(e) => setDsaLevel(e.target.value as MlDsaLevel)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="44">ML-DSA-44 (NIST Category 2)</option>
                <option value="65">ML-DSA-65 (NIST Category 3 - 推奨)</option>
                <option value="87">ML-DSA-87 (NIST Category 5)</option>
              </select>
            </div>
          )}

          {keyType === 'pgp' && (
            <>
              <div>
                <label className="block text-slate-400 mb-1">ユーザー氏名</label>
                <input
                  type="text"
                  value={pgpName}
                  onChange={(e) => setPgpName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={pgpEmail}
                  onChange={(e) => setPgpEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">鍵アルゴリズム形式</label>
                <select
                  value={pgpType}
                  onChange={(e) => setPgpType(e.target.value as 'ecc' | 'rsa')}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="ecc">ECC (Curve25519 - 高速・軽量)</option>
                  <option value="rsa">RSA (従来互換性)</option>
                </select>
              </div>
              {pgpType === 'rsa' && (
                <div>
                  <label className="block text-slate-400 mb-1">RSA ビット長</label>
                  <select
                    value={pgpRsaBits}
                    onChange={(e) => setPgpRsaBits(Number(e.target.value) as 2048 | 4096)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value={2048}>2048 bit</option>
                    <option value={4096}>4096 bit</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-slate-400 mb-1">パスフレーズ保護 (任意)</label>
                <input
                  type="password"
                  value={pgpPassphrase}
                  onChange={(e) => setPgpPassphrase(e.target.value)}
                  placeholder="空欄で暗号化なし"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {keyType === 'fhe' && (
            <div>
              <label className="block text-slate-400 mb-1">Paillier 鍵長</label>
              <select
                value={fheKeyBits}
                onChange={(e) => setFheKeyBits(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value={1024}>1024 bit (高速ブラウザデモ)</option>
                <option value={2048}>2048 bit (高セキュリティ)</option>
              </select>
            </div>
          )}

          {keyType === 'abe-user' && (
            <>
              <div>
                <label className="block text-slate-400 mb-1">ユーザー識別子 (ID)</label>
                <input
                  type="text"
                  value={abeUserId}
                  onChange={(e) => setAbeUserId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-400 mb-1">付与する属性リスト (カンマ区切り)</label>
                <input
                  type="text"
                  value={abeAttributes}
                  onChange={(e) => setAbeAttributes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="dept:security, level:admin, location:tokyo"
                />
              </div>
            </>
          )}

          {keyType === 'passphrase' && (
            <>
              <div>
                <label className="block text-slate-400 mb-1">文字数: {passLength}</label>
                <input
                  type="range"
                  min="8"
                  max="64"
                  value={passLength}
                  onChange={(e) => setPassLength(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-2 items-center pt-2">
                <label className="flex items-center gap-1.5 text-slate-300">
                  <input
                    type="checkbox"
                    checked={passIncludeUpper}
                    onChange={(e) => setPassIncludeUpper(e.target.checked)}
                    className="rounded accent-indigo-600"
                  />
                  <span>英大文字 (A-Z)</span>
                </label>
                <label className="flex items-center gap-1.5 text-slate-300">
                  <input
                    type="checkbox"
                    checked={passIncludeLower}
                    onChange={(e) => setPassIncludeLower(e.target.checked)}
                    className="rounded accent-indigo-600"
                  />
                  <span>英小文字 (a-z)</span>
                </label>
                <label className="flex items-center gap-1.5 text-slate-300">
                  <input
                    type="checkbox"
                    checked={passIncludeDigits}
                    onChange={(e) => setPassIncludeDigits(e.target.checked)}
                    className="rounded accent-indigo-600"
                  />
                  <span>数字 (0-9)</span>
                </label>
                <label className="flex items-center gap-1.5 text-slate-300">
                  <input
                    type="checkbox"
                    checked={passIncludeSymbols}
                    onChange={(e) => setPassIncludeSymbols(e.target.checked)}
                    className="rounded accent-indigo-600"
                  />
                  <span>特殊記号 (!@#$)</span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>暗号論的演算を実行中...</span>
            </>
          ) : (
            <>
              <Key className="w-4 h-4" />
              <span>この設定で暗号鍵を生成する</span>
            </>
          )}
        </button>
      </div>

      {/* Generated Result Section */}
      {generatedKeyItem && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400">
                <Check className="w-4 h-4" />
              </span>
              <span className="text-sm font-bold text-slate-100">
                鍵生成が完了しました
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {generatedKeyItem.title}
            </span>
          </div>

          {/* Direct Workflow Navigation Banner */}
          <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>生成した鍵で暗号化・署名ツールへ移動</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                この鍵をクリップボードや保管庫に保持したまま、対応ツールを即座に開きます
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(keyType.startsWith('aes') || keyType === 'chacha20') && (
                <button
                  type="button"
                  onClick={() => handleQuickUse(keyType.startsWith('aes') ? 'aes' : 'chacha')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>暗号化ツールを開く</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {keyType === 'rsa-oaep' && (
                <button
                  type="button"
                  onClick={() => handleQuickUse('rsa')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>RSA暗号化スタジオを開く</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {(keyType === 'rsa-pss' ||
                keyType === 'rsa-pkcs1' ||
                keyType === 'ecdsa' ||
                keyType === 'ed25519' ||
                keyType === 'secp256k1') && (
                <button
                  type="button"
                  onClick={() => handleQuickUse('signatures')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>電子署名ツールを開く</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {(keyType === 'ecdh' || keyType === 'x25519') && (
                <button
                  type="button"
                  onClick={() => handleQuickUse('ecdh')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>ECDH鍵共有ツールを開く</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {(keyType === 'pqc-kem' || keyType === 'pqc-dsa') && (
                <button
                  type="button"
                  onClick={() => handleQuickUse('pqc')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Atom className="w-3.5 h-3.5" />
                  <span>耐量子暗号ツールを開く</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {keyType === 'pgp' && (
                <button
                  type="button"
                  onClick={() => handleQuickUse('pgp')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>OpenPGPスタジオを開く</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {keyType === 'ring' && (
                <button
                  type="button"
                  onClick={() => handleQuickUse('ring-signature')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>リング署名ツールを開く</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {keyType === 'fhe' && (
                <button
                  type="button"
                  onClick={() => handleQuickUse('fhe')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>完全準同型暗号を開く</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {keyType.startsWith('abe') && (
                <button
                  type="button"
                  onClick={() => handleQuickUse('abe')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>属性ベース暗号を開く</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Append to Vault Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-xs">
              <PlusCircle className="w-4 h-4" />
              <span>暗号化鍵保管庫へ登録</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">鍵のタイトル</label>
                <input
                  type="text"
                  value={appendTitle}
                  onChange={(e) => setAppendTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  placeholder="タイトルを入力"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">管理メモ</label>
                <input
                  type="text"
                  value={appendMemo}
                  onChange={(e) => setAppendMemo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  placeholder="用途や保管期限など"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleAppendToVault}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>保管庫に追加</span>
              </button>

              {appendSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>保管庫への登録が完了しました</span>
                  {onNavigateToVault && (
                    <button
                      type="button"
                      onClick={onNavigateToVault}
                      className="underline hover:text-emerald-300 ml-1.5"
                    >
                      保管庫を開いて確認
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Key Displays Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Public Key Display */}
            {generatedKeyItem.publicKeyPem && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    公開鍵 (Public Key)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedKeyItem.publicKeyPem!, 'pub')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                    >
                      {copiedKey === 'pub' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'pub' ? 'コピー済' : 'コピー'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(
                          generatedKeyItem.publicKeyPem!,
                          `public_${keyType}_${Date.now()}.txt`
                        )
                      }
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>
                <pre className="text-xs font-mono p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap break-all select-all">
                  {generatedKeyItem.publicKeyPem}
                </pre>
              </div>
            )}

            {/* Private Key Display */}
            {generatedKeyItem.privateKeyPem && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-300 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-rose-400" />
                    <span>秘密鍵 (Private / Secret Key)</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsPrivateKeyRevealed(!isPrivateKeyRevealed)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                    >
                      {isPrivateKeyRevealed ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span>{isPrivateKeyRevealed ? '隠す' : '表示'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedKeyItem.privateKeyPem!, 'priv')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                    >
                      {copiedKey === 'priv' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'priv' ? 'コピー済' : 'コピー'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(
                          generatedKeyItem.privateKeyPem!,
                          `private_${keyType}_${Date.now()}.txt`
                        )
                      }
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>
                <pre className="text-xs font-mono p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap break-all select-all">
                  {isPrivateKeyRevealed
                    ? generatedKeyItem.privateKeyPem
                    : '●'.repeat(Math.min(60, generatedKeyItem.privateKeyPem.length)) +
                      '\n(安全のため非表示中。上の表示ボタンで確認できます)'}
                </pre>
              </div>
            )}

            {/* Raw Symmetric Key Base64 & Hex */}
            {generatedKeyItem.rawKeyBase64 && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 md:col-span-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    共通鍵・パスフレーズ (Raw Secret)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedKeyItem.rawKeyBase64!, 'raw-b64')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                    >
                      {copiedKey === 'raw-b64' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Base64コピー</span>
                    </button>
                    {generatedKeyItem.rawKeyHex && (
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedKeyItem.rawKeyHex!, 'raw-hex')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                      >
                        {copiedKey === 'raw-hex' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Hexコピー</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(
                          generatedKeyItem.rawKeyBase64!,
                          `secret_${keyType}_${Date.now()}.key`
                        )
                      }
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>保存</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400">
                    Base64 形式:
                  </div>
                  <pre className="text-xs font-mono p-2 bg-slate-900 border border-slate-800 rounded text-indigo-300 select-all whitespace-pre-wrap break-all">
                    {generatedKeyItem.rawKeyBase64}
                  </pre>
                </div>

                {generatedKeyItem.rawKeyHex && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] text-slate-400">
                      Hex 形式:
                    </div>
                    <pre className="text-xs font-mono p-2 bg-slate-900 border border-slate-800 rounded text-slate-300 select-all whitespace-pre-wrap break-all">
                      {generatedKeyItem.rawKeyHex}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
