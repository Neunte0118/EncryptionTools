/**
 * OpenSSL CLI & Windows PowerShell Interoperability Cryptographic Utility
 * Compatible with standard OpenSSL `enc` format ("Salted__" header + 8-byte salt + PBKDF2-SHA256)
 * and Windows PowerShell .NET `System.Security.Cryptography`
 */

export const OPENSSL_MAGIC = new Uint8Array([0x53, 0x61, 0x6c, 0x74, 0x65, 0x64, 0x5f, 0x5f]); // "Salted__"

export function isOpenSslEnc(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 16) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== OPENSSL_MAGIC[i]) return false;
  }
  return true;
}

export function isOpenSslEncBase64(b64: string): boolean {
  const cleaned = b64.trim().replace(/\s+/g, '');
  return cleaned.startsWith('U2FsdGVkX1');
}

/**
 * Encrypt bytes using OpenSSL `enc -aes-256-cbc -salt -pbkdf2` compatible format
 */
export async function encryptOpenSslAes(
  data: ArrayBuffer | Uint8Array,
  password: string,
  keyBits: 128 | 192 | 256 = 256,
  iterations: number = 100000
): Promise<Uint8Array> {
  const salt = window.crypto.getRandomValues(new Uint8Array(8));
  const keyBytesLen = keyBits / 8;
  const ivBytesLen = 16;
  const totalDeriveBytes = keyBytesLen + ivBytesLen;

  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    totalDeriveBytes * 8
  );

  const derivedBytes = new Uint8Array(derivedBits);
  const keyBytes = derivedBytes.slice(0, keyBytesLen);
  const ivBytes = derivedBytes.slice(keyBytesLen, keyBytesLen + ivBytesLen);

  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  const rawData = data instanceof Uint8Array ? data : new Uint8Array(data);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: ivBytes },
    aesKey,
    rawData as BufferSource
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);
  const result = new Uint8Array(8 + 8 + ciphertext.length);
  result.set(OPENSSL_MAGIC, 0);
  result.set(salt, 8);
  result.set(ciphertext, 16);

  return result;
}

/**
 * Decrypt bytes formatted in OpenSSL `enc -salt -pbkdf2` format
 */
export async function decryptOpenSslAes(
  encryptedData: ArrayBuffer | Uint8Array,
  password: string,
  keyBits: 128 | 192 | 256 = 256,
  iterations: number = 100000
): Promise<Uint8Array> {
  const bytes = encryptedData instanceof Uint8Array ? encryptedData : new Uint8Array(encryptedData);
  if (!isOpenSslEnc(bytes)) {
    throw new Error('OpenSSL形式（Salted__ ヘッダー）ではありません');
  }

  const salt = bytes.slice(8, 16);
  const ciphertext = bytes.slice(16);
  const keyBytesLen = keyBits / 8;
  const ivBytesLen = 16;
  const totalDeriveBytes = keyBytesLen + ivBytesLen;

  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const tryDecryptWithIter = async (iter: number): Promise<Uint8Array> => {
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: iter,
        hash: 'SHA-256',
      },
      passwordKey,
      totalDeriveBytes * 8
    );

    const derivedBytes = new Uint8Array(derivedBits);
    const keyBytes = derivedBytes.slice(0, keyBytesLen);
    const ivBytes = derivedBytes.slice(keyBytesLen, keyBytesLen + ivBytesLen);

    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: ivBytes },
      aesKey,
      ciphertext as BufferSource
    );

    return new Uint8Array(decryptedBuffer);
  };

  try {
    return await tryDecryptWithIter(iterations);
  } catch (err) {
    if (iterations === 100000) {
      try {
        return await tryDecryptWithIter(10000);
      } catch {
        // rethrow original error
      }
    }
    throw new Error('復号に失敗しました。パスワードまたはパラメータを確認してください。');
  }
}

/**
 * Generate copyable Linux OpenSSL CLI command for AES
 */
export function getAesLinuxCommand(params: {
  action: 'encrypt' | 'decrypt';
  keyLength: 128 | 192 | 256;
  isBase64?: boolean;
  filename?: string;
  hasPassword?: boolean;
  password?: string;
  iterations?: number;
  rawKeyHex?: string;
  ivHex?: string;
  mode?: string;
}): string {
  const cipher = params.mode ? params.mode.toLowerCase() : `aes-${params.keyLength}-cbc`;
  const iter = params.iterations || 100000;
  const aFlag = params.isBase64 ? ' -a' : '';

  if (params.hasPassword) {
    const passArg = params.password ? ` -pass pass:"${params.password.replace(/"/g, '\\"')}"` : '';
    if (params.action === 'encrypt') {
      const inName = params.filename || 'plaintext.txt';
      const outName = params.filename ? `${params.filename}.enc` : 'encrypted.enc';
      return `# Linux (OpenSSL CLI) パスワード暗号化:\nopenssl enc -${cipher}${aFlag} -salt -pbkdf2 -iter ${iter}${passArg} -in "${inName}" -out "${outName}"`;
    } else {
      const inName = params.filename || 'encrypted.enc';
      const outName = params.filename && params.filename.endsWith('.enc') ? params.filename.slice(0, -4) : 'decrypted.txt';
      return `# Linux (OpenSSL CLI) パスワード復号:\nopenssl enc -d -${cipher}${aFlag} -salt -pbkdf2 -iter ${iter}${passArg} -in "${inName}" -out "${outName}"`;
    }
  } else {
    // Raw Key + IV mode
    const kArg = params.rawKeyHex ? ` -K "${params.rawKeyHex}"` : ' -K "<HEX_KEY_32BYTES>"';
    const ivArg = params.ivHex ? ` -iv "${params.ivHex}"` : ' -iv "<HEX_IV_16BYTES>"';
    if (params.action === 'encrypt') {
      const inName = params.filename || 'plaintext.txt';
      const outName = params.filename ? `${params.filename}.enc` : 'encrypted.enc';
      return `# Linux (OpenSSL CLI) 生鍵(Key/IV) 暗号化:\nopenssl enc -${cipher}${aFlag}${kArg}${ivArg} -in "${inName}" -out "${outName}"`;
    } else {
      const inName = params.filename || 'encrypted.enc';
      const outName = params.filename && params.filename.endsWith('.enc') ? params.filename.slice(0, -4) : 'decrypted.txt';
      return `# Linux (OpenSSL CLI) 生鍵(Key/IV) 復号:\nopenssl enc -d -${cipher}${aFlag}${kArg}${ivArg} -in "${inName}" -out "${outName}"`;
    }
  }
}

/**
 * Generate copyable Windows PowerShell commands/scripts for AES
 */
export function getAesPowerShellScript(params: {
  action: 'encrypt' | 'decrypt';
  keyLength: 128 | 192 | 256;
  isBase64?: boolean;
  filename?: string;
  hasPassword?: boolean;
  password?: string;
  iterations?: number;
  rawKeyBase64?: string;
}): { nativePowerShell: string; openSslCli: string } {
  const cipher = `aes-${params.keyLength}-cbc`;
  const iter = params.iterations || 100000;
  const aFlag = params.isBase64 ? ' -a' : '';
  const passVal = params.password ? params.password.replace(/"/g, '`"') : 'YOUR_PASSWORD_HERE';
  const keyBytes = params.keyLength / 8;

  const inName = params.filename || (params.action === 'encrypt' ? 'plaintext.txt' : 'encrypted.enc');
  const outName = params.action === 'encrypt'
    ? (params.filename ? `${params.filename}.enc` : 'encrypted.enc')
    : (params.filename && params.filename.endsWith('.enc') ? params.filename.slice(0, -4) : 'decrypted.txt');

  const openSslCli = params.action === 'encrypt'
    ? `openssl enc -${cipher}${aFlag} -salt -pbkdf2 -iter ${iter} -pass pass:"${passVal}" -in "${inName}" -out "${outName}"`
    : `openssl enc -d -${cipher}${aFlag} -salt -pbkdf2 -iter ${iter} -pass pass:"${passVal}" -in "${inName}" -out "${outName}"`;

  let nativePowerShell = '';
  if (params.action === 'encrypt') {
    nativePowerShell = `# Windows PowerShell (.NET) ネイティブ暗号化スクリプト
$password = "${passVal}"
$plainBytes = [System.IO.File]::ReadAllBytes("${inName}")

# 8バイトのランダムソルト生成
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$salt = New-Object byte[] 8
$rng.GetBytes($salt)

# PBKDF2 (SHA-256, ${iter}回) で鍵 (${keyBytes}バイト) と IV (16バイト) を導出
$kdf = [System.Security.Cryptography.Rfc2898DeriveBytes]::new($password, $salt, ${iter}, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
$key = $kdf.GetBytes(${keyBytes})
$iv = $kdf.GetBytes(16)

$aes = [System.Security.Cryptography.Aes]::Create()
$aes.Key = $key
$aes.IV = $iv
$aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
$aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7

$enc = $aes.CreateEncryptor()
$cipherBytes = $enc.TransformFinalBlock($plainBytes, 0, $plainBytes.Length)

# OpenSSL互換ヘッダー ("Salted__" + ソルト + 暗号文)
$header = [System.Text.Encoding]::ASCII.GetBytes("Salted__")
$finalBytes = New-Object byte[] ($header.Length + $salt.Length + $cipherBytes.Length)
[System.Buffer]::BlockCopy($header, 0, $finalBytes, 0, 8)
[System.Buffer]::BlockCopy($salt, 0, $finalBytes, 8, 8)
[System.Buffer]::BlockCopy($cipherBytes, 0, $finalBytes, 16, $cipherBytes.Length)

[System.IO.File]::WriteAllBytes("${outName}", $finalBytes)
Write-Host "暗号化完了: ${outName}" -ForegroundColor Green`;
  } else {
    nativePowerShell = `# Windows PowerShell (.NET) ネイティブ復号スクリプト
$password = "${passVal}"
$fileBytes = [System.IO.File]::ReadAllBytes("${inName}")

# "Salted__" ヘッダー確認
$magic = [System.Text.Encoding]::ASCII.GetString($fileBytes[0..7])
if ($magic -ne "Salted__") { throw "OpenSSL Salted__ 形式ではありません" }

$salt = $fileBytes[8..15]
$cipherBytes = $fileBytes[16..($fileBytes.Length - 1)]

# PBKDF2 (SHA-256, ${iter}回) で鍵 (${keyBytes}バイト) と IV (16バイト) を導出
$kdf = [System.Security.Cryptography.Rfc2898DeriveBytes]::new($password, $salt, ${iter}, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
$key = $kdf.GetBytes(${keyBytes})
$iv = $kdf.GetBytes(16)

$aes = [System.Security.Cryptography.Aes]::Create()
$aes.Key = $key
$aes.IV = $iv
$aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
$aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7

$dec = $aes.CreateDecryptor()
$plainBytes = $dec.TransformFinalBlock($cipherBytes, 0, $cipherBytes.Length)

[System.IO.File]::WriteAllBytes("${outName}", $plainBytes)
Write-Host "復号完了: ${outName}" -ForegroundColor Green`;
  }

  return { nativePowerShell, openSslCli };
}

/**
 * Generate copyable Linux OpenSSL CLI commands for RSA
 */
export function getRsaLinuxCommand(params: {
  action: 'encrypt' | 'decrypt';
  hashAlgo: string;
  isBase64?: boolean;
}): string {
  const hash = params.hashAlgo.toLowerCase().replace('-', '');
  if (params.action === 'encrypt') {
    return `# Linux (OpenSSL CLI) RSA-OAEP 暗号化:
# 1. テキスト/バイナリの暗号化
openssl pkeyutl -encrypt -pubin -inkey rsa_public.pem -in plaintext.txt -out cipher.bin -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:${hash}

# 2. Base64文字列として出力する場合:
openssl pkeyutl -encrypt -pubin -inkey rsa_public.pem -in plaintext.txt -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:${hash} | base64 -w 0 > cipher.b64`;
  } else {
    return `# Linux (OpenSSL CLI) RSA-OAEP 復号:
# 1. バイナリ暗号文 (cipher.bin) の復号
openssl pkeyutl -decrypt -inkey rsa_private.pem -in cipher.bin -out decrypted.txt -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:${hash}

# 2. Base64暗号文 (cipher.b64) の復号パイプライン:
cat cipher.b64 | base64 -d | openssl pkeyutl -decrypt -inkey rsa_private.pem -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:${hash}`;
  }
}

/**
 * Generate copyable Windows PowerShell scripts for RSA
 */
export function getRsaPowerShellScript(params: {
  action: 'encrypt' | 'decrypt';
  hashAlgo: string;
}): { nativePowerShell: string; openSslCli: string } {
  const hash = params.hashAlgo.replace('-', '');
  const paddingEnum = `[System.Security.Cryptography.RSAEncryptionPadding]::Oaep${hash}`;

  const openSslHash = params.hashAlgo.toLowerCase().replace('-', '');
  const openSslCli = params.action === 'encrypt'
    ? `openssl pkeyutl -encrypt -pubin -inkey rsa_public.pem -in plaintext.txt -out cipher.bin -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:${openSslHash}`
    : `openssl pkeyutl -decrypt -inkey rsa_private.pem -in cipher.bin -out decrypted.txt -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:${openSslHash}`;

  let nativePowerShell = '';
  if (params.action === 'encrypt') {
    nativePowerShell = `# Windows PowerShell (PS 7+ / .NET) ネイティブ RSA-OAEP 暗号化
$pubPem = Get-Content -Raw "rsa_public.pem"
$rsa = [System.Security.Cryptography.RSA]::Create()
$rsa.ImportFromPem($pubPem)

$plainBytes = [System.IO.File]::ReadAllBytes("plaintext.txt")
$cipherBytes = $rsa.Encrypt($plainBytes, ${paddingEnum})

[System.IO.File]::WriteAllBytes("cipher.bin", $cipherBytes)
$b64 = [System.Convert]::ToBase64String($cipherBytes)
Write-Host "暗号化完了 (Base64): $b64" -ForegroundColor Green`;
  } else {
    nativePowerShell = `# Windows PowerShell (PS 7+ / .NET) ネイティブ RSA-OAEP 復号
$privPem = Get-Content -Raw "rsa_private.pem"
$rsa = [System.Security.Cryptography.RSA]::Create()
$rsa.ImportFromPem($privPem)

$cipherBytes = [System.IO.File]::ReadAllBytes("cipher.bin")
# または Base64 文字列からの場合:
# $cipherBytes = [System.Convert]::FromBase64String("BASE64_CIPHERTEXT_HERE")

$plainBytes = $rsa.Decrypt($cipherBytes, ${paddingEnum})
[System.IO.File]::WriteAllBytes("decrypted.txt", $plainBytes)
Write-Host "復号テキスト: " ([System.Text.Encoding]::UTF8.GetString($plainBytes)) -ForegroundColor Green`;
  }

  return { nativePowerShell, openSslCli };
}

/**
 * Generate copyable Linux CLI commands for Password-Protected ZIP
 */
export function getZipLinuxCommand(params: {
  action: 'create' | 'extract';
  filename?: string;
  password?: string;
  strength?: 'aes-256' | 'zipcrypto';
  files?: string[];
}): string {
  const archive = params.filename || 'archive.zip';
  const pass = params.password ? params.password.replace(/"/g, '\\"') : 'YOUR_PASSWORD';
  const isAes = params.strength === 'aes-256';
  const filesList = params.files && params.files.length > 0 ? params.files.map((f) => `"${f}"`).join(' ') : 'file1.txt file2.pdf';

  if (params.action === 'create') {
    if (isAes) {
      return `# Linux (7-Zip CLI) AES-256 暗号化ZIP 作成 (WinZip AES規格):
7z a -tzip -p"${pass}" -mem=AES256 "${archive}" ${filesList}

# ※ p7zip が未導入の場合: sudo apt install p7zip-full (または dnf install p7zip)`;
    } else {
      return `# Linux (標準 zip コマンド) ZipCrypto 暗号化ZIP 作成:
zip -e -P "${pass}" "${archive}" ${filesList}

# ※ 対話式で安全にパスワードを入力する場合:
zip -e "${archive}" ${filesList}`;
    }
  } else {
    if (isAes) {
      return `# Linux (7-Zip CLI) AES-256 暗号化ZIP 解凍:
7z x -p"${pass}" "${archive}"

# ※ またはモダンな unzip (AES対応環境):
unzip -P "${pass}" "${archive}"`;
    } else {
      return `# Linux (標準 unzip) 暗号化ZIP 解凍 (ZipCrypto / 標準規格):
unzip -P "${pass}" "${archive}"

# ※ 対話式でパスワード入力して解凍する場合:
unzip "${archive}"`;
    }
  }
}

/**
 * Generate copyable Windows PowerShell scripts for Password-Protected ZIP
 */
export function getZipPowerShellScript(params: {
  action: 'create' | 'extract';
  filename?: string;
  password?: string;
  strength?: 'aes-256' | 'zipcrypto';
  files?: string[];
}): { nativePowerShell: string; openSslCli: string } {
  const archive = params.filename || 'archive.zip';
  const pass = params.password ? params.password.replace(/"/g, '`"') : 'YOUR_PASSWORD';
  const isAes = params.strength === 'aes-256';
  const filesList = params.files && params.files.length > 0 ? params.files.map((f) => `"${f}"`).join(' ') : '"file1.txt", "file2.pdf"';

  const sevenZipCli = params.action === 'create'
    ? `7z a -tzip -p"${pass}" ${isAes ? '-mem=AES256 ' : ''}"${archive}" ${filesList.replace(/,/g, '')}`
    : `7z x -p"${pass}" "${archive}" -o"extracted"`;

  let nativePowerShell = '';
  if (params.action === 'create') {
    nativePowerShell = `# Windows PowerShell 暗号化ZIP 作成
# 方法1: 7-Zip CLI を使用 (推奨 - AES-256対応)
7z a -tzip -p"${pass}" ${isAes ? '-mem=AES256 ' : ''}"${archive}" ${filesList.replace(/,/g, '')}

# 方法2: Windows 11 / 10 標準の tar.exe (パスワードなし標準ZIPの場合)
# tar -a -cf "${archive}" ${filesList.replace(/,/g, '')}`;
  } else {
    nativePowerShell = `# Windows PowerShell 暗号化ZIP 解凍
# 方法1: 7-Zip CLI での解凍 (AES-256 / ZipCrypto 両対応)
7z x -p"${pass}" "${archive}" -o"extracted"

# 方法2: Windows 10 / 11 エクスプローラー連携 (GUI)
# 生成された "${archive}" をエクスプローラーでダブルクリックし、
# パスワード「${pass}」を入力してそのまま解凍できます。`;
  }

  return { nativePowerShell, openSslCli: sevenZipCli };
}

/**
 * Generate copyable Linux CLI commands for ChaCha20
 */
export function getChaChaLinuxCommand(params: {
  action: 'encrypt' | 'decrypt';
  variant: string;
  filename?: string;
  isBase64?: boolean;
}): string {
  const cipher = params.variant === 'chacha20-poly1305' ? 'chacha20-poly1305' : 'chacha20';
  const aFlag = params.isBase64 ? ' -a' : '';
  const inName = params.filename || (params.action === 'encrypt' ? 'plaintext.txt' : 'encrypted.enc');
  const outName = params.action === 'encrypt' ? 'encrypted.enc' : 'decrypted.txt';

  if (params.action === 'encrypt') {
    return `# Linux (OpenSSL CLI) ChaCha20 暗号化:
openssl enc -${cipher}${aFlag} -K "<HEX_KEY_32BYTES>" -iv "<HEX_NONCE_12BYTES>" -in "${inName}" -out "${outName}"`;
  } else {
    return `# Linux (OpenSSL CLI) ChaCha20 復号:
openssl enc -d -${cipher}${aFlag} -K "<HEX_KEY_32BYTES>" -iv "<HEX_NONCE_12BYTES>" -in "${inName}" -out "${outName}"`;
  }
}

/**
 * Generate copyable Windows PowerShell scripts for ChaCha20
 */
export function getChaChaPowerShellScript(params: {
  action: 'encrypt' | 'decrypt';
  variant: string;
}): { nativePowerShell: string; openSslCli: string } {
  const openSslCli = params.action === 'encrypt'
    ? `openssl enc -chacha20-poly1305 -K "<HEX_KEY_32BYTES>" -iv "<HEX_NONCE_12BYTES>" -in "plaintext.txt" -out "encrypted.enc"`
    : `openssl enc -d -chacha20-poly1305 -K "<HEX_KEY_32BYTES>" -iv "<HEX_NONCE_12BYTES>" -in "encrypted.enc" -out "decrypted.txt"`;

  const nativePowerShell = `# Windows PowerShell (.NET Core 6+ / PS 7+) ChaCha20-Poly1305
$key = [System.Convert]::FromHexString("<HEX_KEY_32BYTES>")
$nonce = [System.Convert]::FromHexString("<HEX_NONCE_12BYTES>")
$chacha = [System.Security.Cryptography.ChaCha20Poly1305]::new($key)

${
  params.action === 'encrypt'
    ? `$plain = [System.IO.File]::ReadAllBytes("plaintext.txt")
$tag = New-Object byte[] 16
$cipher = New-Object byte[] $plain.Length
$chacha.Encrypt($nonce, $plain, $cipher, $tag)
[System.IO.File]::WriteAllBytes("encrypted.enc", $cipher)`
    : `$cipher = [System.IO.File]::ReadAllBytes("encrypted.enc")
$tag = [System.Convert]::FromHexString("<TAG_HEX_16BYTES>")
$plain = New-Object byte[] $cipher.Length
$chacha.Decrypt($nonce, $cipher, $tag, $plain)
[System.IO.File]::WriteAllBytes("decrypted.txt", $plain)`
}`;

  return { nativePowerShell, openSslCli };
}
