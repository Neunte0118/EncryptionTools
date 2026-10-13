/**
 * Self-Decrypting HTML Package Generator
 * 
 * Takes plaintext or binary files, encrypts with AES-256-GCM (PBKDF2 100,000 iterations),
 * and bundles an elegant, self-contained standalone HTML document that can be opened in ANY browser
 * completely offline with ZERO dependencies or external servers.
 */

import { deriveKeyFromPassword, bufferToBase64 } from './cryptoUtils';

export interface SelfDecryptPackageOptions {
  title?: string;
  hint?: string;
  payloadType: 'text' | 'file';
  filename?: string;
  mimeType?: string;
}

/**
 * Encrypt data and construct the complete standalone HTML string.
 */
export async function createSelfDecryptingHtml(
  data: ArrayBuffer | string,
  password: string,
  options: SelfDecryptPackageOptions
): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Prepare input buffer
  let plainBuffer: ArrayBuffer;
  if (typeof data === 'string') {
    plainBuffer = new TextEncoder().encode(data).buffer;
  } else {
    plainBuffer = data;
  }

  // Derive AES-GCM 256-bit key from password
  const key = await deriveKeyFromPassword(password, salt);

  // Encrypt with AES-GCM
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainBuffer
  );

  const saltB64 = bufferToBase64(salt.buffer);
  const ivB64 = bufferToBase64(iv.buffer);
  const cipherB64 = bufferToBase64(ciphertextBuffer);

  const payloadMeta = {
    title: options.title || '暗号化セキュアパッケージ',
    hint: options.hint || '',
    type: options.payloadType,
    filename: options.filename || (options.payloadType === 'text' ? 'secure-message.txt' : 'decrypted-file.dat'),
    mimeType: options.mimeType || (options.payloadType === 'text' ? 'text/plain' : 'application/octet-stream'),
    createdAt: new Date().toISOString(),
    salt: saltB64,
    iv: ivB64,
    ciphertext: cipherB64,
  };

  const jsonBundle = JSON.stringify(payloadMeta);

  // Build clean, responsive, dependency-free HTML with embedded styles and Web Crypto decryption engine
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(payloadMeta.title)} - 自己復号パッケージ</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    *::-webkit-scrollbar { display: none; width: 0; height: 0; }
    body {
      background: #020617;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
    }
    .card {
      width: 100%;
      max-width: 32rem;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 1rem;
      padding: 1.75rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 600;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
      margin-bottom: 0.75rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 0.375rem;
    }
    .desc {
      font-size: 0.8125rem;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .meta-box {
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 0.625rem;
      padding: 0.875rem;
      font-size: 0.75rem;
      margin-bottom: 1.25rem;
      color: #cbd5e1;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.375rem;
    }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-label { color: #64748b; }
    .meta-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .field {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 0.375rem;
    }
    .input-wrap {
      position: relative;
    }
    input[type="password"], input[type="text"] {
      width: 100%;
      background: #020617;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 0.625rem 2.5rem 0.625rem 0.75rem;
      color: #f8fafc;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus {
      border-color: #6366f1;
    }
    .toggle-btn {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 0.75rem;
      padding: 0.25rem;
    }
    .toggle-btn:hover { color: #cbd5e1; }
    .btn {
      width: 100%;
      padding: 0.75rem;
      background: #4f46e5;
      color: #ffffff;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .btn:hover { background: #4338ca; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-download {
      background: #059669;
    }
    .btn-download:hover { background: #047857; }
    .btn-copy {
      background: #334155;
      margin-top: 0.5rem;
    }
    .btn-copy:hover { background: #475569; }
    .error {
      margin-top: 1rem;
      padding: 0.75rem;
      background: rgba(159, 18, 57, 0.4);
      border: 1px solid #be123c;
      border-radius: 0.5rem;
      font-size: 0.75rem;
      color: #fda4af;
    }
    .result-box {
      margin-top: 1.25rem;
      padding-top: 1.25rem;
      border-top: 1px solid #1e293b;
    }
    .text-content {
      width: 100%;
      min-height: 8rem;
      max-height: 18rem;
      overflow-y: auto;
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 0.5rem;
      padding: 0.75rem;
      color: #f1f5f9;
      font-size: 0.8125rem;
      white-space: pre-wrap;
      word-break: break-all;
      margin-bottom: 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .security-notice {
      margin-top: 1.25rem;
      padding: 0.75rem;
      border-radius: 0.5rem;
      background: rgba(6, 78, 59, 0.2);
      border: 1px solid rgba(5, 150, 105, 0.3);
      font-size: 0.6875rem;
      color: #6ee7b7;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span>🔒 AES-256-GCM 自己復号パッケージ</span>
    </div>
    <h1>${escapeHtml(payloadMeta.title)}</h1>
    <p class="desc">
      このファイルはブラウザのWeb Crypto API（PBKDF2-SHA256 / AES-GCM）によって暗号化されています。サーバー通信なしでローカル復号されます。
    </p>

    <div class="meta-box">
      <div class="meta-row">
        <span class="meta-label">種別:</span>
        <span class="meta-value">${payloadMeta.type === 'text' ? 'テキストメッセージ' : '添付ファイル (' + escapeHtml(payloadMeta.filename) + ')'}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">暗号規格:</span>
        <span class="meta-value">AES-256-GCM (PBKDF2 100k)</span>
      </div>
      ${payloadMeta.hint ? `
      <div class="meta-row" style="margin-top: 0.375rem; padding-top: 0.375rem; border-top: 1px dashed #1e293b;">
        <span class="meta-label">パスワードのヒント:</span>
        <span class="meta-value" style="color: #fef08a;">${escapeHtml(payloadMeta.hint)}</span>
      </div>` : ''}
    </div>

    <form id="decryptForm" onsubmit="handleDecrypt(event)">
      <div class="field">
        <label for="pwd">パスワードを入力</label>
        <div class="input-wrap">
          <input type="password" id="pwd" placeholder="設定されたパスワード" autocomplete="current-password" autofocus required />
          <button type="button" class="toggle-btn" onclick="togglePasswordVisibility()">表示</button>
        </div>
      </div>
      <button type="submit" id="btnDecrypt" class="btn">
        <span>復号して中身を開く</span>
      </button>
    </form>

    <div id="errorBox" class="error" style="display: none;"></div>

    <div id="resultBox" class="result-box" style="display: none;">
      <h2 style="font-size: 0.875rem; font-weight: 600; color: #a7f3d0; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.375rem;">
        ✓ 復号に成功しました
      </h2>
      <div id="textContainer" style="display: none;">
        <div id="textContent" class="text-content"></div>
        <button type="button" id="btnCopy" class="btn btn-copy" onclick="copyDecryptedText()">
          テキストをクリップボードにコピー
        </button>
      </div>
      <div id="fileContainer" style="display: none;">
        <p style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.75rem;">
          ファイル名: <strong id="outFilename" style="color: #f8fafc;"></strong>
        </p>
        <button type="button" id="btnDownload" class="btn btn-download" onclick="downloadDecryptedFile()">
          復号したファイルをダウンロード
        </button>
      </div>
    </div>

    <div class="security-notice">
      🛡️ 完全オフライン安全: インターネット回線を切断（機内モード）した状態でも問題なく復号可能です。パスワードや復号データが外部へ送信されることは一切ありません。
    </div>
  </div>

  <script id="encrypted-package" type="application/json">
${jsonBundle}
  </script>

  <script>
    let decryptedFileData = null;
    let decryptedFilename = '';

    function togglePasswordVisibility() {
      const input = document.getElementById('pwd');
      const btn = event.target;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '隠す';
      } else {
        input.type = 'password';
        btn.textContent = '表示';
      }
    }

    function base64ToBuffer(base64) {
      const clean = base64.replace(/[\\r\\n\\s]+/g, '');
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }

    async function handleDecrypt(e) {
      e.preventDefault();
      const pwd = document.getElementById('pwd').value;
      const errorBox = document.getElementById('errorBox');
      const resultBox = document.getElementById('resultBox');
      const btnDecrypt = document.getElementById('btnDecrypt');

      errorBox.style.display = 'none';
      errorBox.textContent = '';
      btnDecrypt.disabled = true;
      btnDecrypt.textContent = '復号処理中...';

      try {
        const pkgData = JSON.parse(document.getElementById('encrypted-package').textContent);
        const salt = new Uint8Array(base64ToBuffer(pkgData.salt));
        const iv = new Uint8Array(base64ToBuffer(pkgData.iv));
        const ciphertext = base64ToBuffer(pkgData.ciphertext);

        // Derive AES-GCM Key via PBKDF2
        const enc = new TextEncoder().encode(pwd);
        const baseKey = await window.crypto.subtle.importKey(
          'raw',
          enc,
          'PBKDF2',
          false,
          ['deriveKey']
        );
        const aesKey = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
          },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        // Decrypt
        const plainBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          aesKey,
          ciphertext
        );

        // Success
        resultBox.style.display = 'block';
        document.getElementById('decryptForm').style.display = 'none';

        if (pkgData.type === 'text') {
          const text = new TextDecoder('utf-8').decode(plainBuffer);
          document.getElementById('textContainer').style.display = 'block';
          document.getElementById('textContent').textContent = text;
        } else {
          decryptedFileData = plainBuffer;
          decryptedFilename = pkgData.filename || 'decrypted-file.dat';
          document.getElementById('fileContainer').style.display = 'block';
          document.getElementById('outFilename').textContent = decryptedFilename;
        }
      } catch (err) {
        errorBox.style.display = 'block';
        errorBox.textContent = '復号に失敗しました。パスワードが正しくないか、データが破損しています。';
      } finally {
        btnDecrypt.disabled = false;
        btnDecrypt.textContent = '復号して中身を開く';
      }
    }

    function copyDecryptedText() {
      const text = document.getElementById('textContent').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btnCopy');
        const orig = btn.textContent;
        btn.textContent = '✓ コピーしました';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      });
    }

    function downloadDecryptedFile() {
      if (!decryptedFileData) return;
      const blob = new Blob([decryptedFileData]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = decryptedFilename || 'decrypted-file.dat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
