/**
 * Self-Decrypting HTML Package Generator
 * Standalone offline HTML package
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
 * Encrypt data and construct the barebones standalone HTML string.
 */
export async function createSelfDecryptingHtml(
  data: ArrayBuffer | string,
  password: string,
  options: SelfDecryptPackageOptions
): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  let plainBuffer: ArrayBuffer;
  if (typeof data === 'string') {
    plainBuffer = new TextEncoder().encode(data).buffer;
  } else {
    plainBuffer = data;
  }

  const key = await deriveKeyFromPassword(password, salt);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainBuffer
  );

  const saltB64 = bufferToBase64(salt.buffer);
  const ivB64 = bufferToBase64(iv.buffer);
  const cipherB64 = bufferToBase64(ciphertextBuffer);

  const payloadMeta = {
    title: options.title || '自己復号パッケージ',
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

  // Stark, unadorned, barebones HTML with CSS almost completely removed
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(payloadMeta.title)} - 自己復号</title>
  <style>
    body {
      font-family: monospace;
      max-width: 640px;
      margin: 40px auto;
      padding: 0 16px;
      color: #000;
      background: #fff;
      line-height: 1.4;
    }
    h1 {
      font-size: 16px;
      margin: 0 0 8px 0;
    }
    hr {
      border: none;
      border-top: 1px solid #000;
      margin: 12px 0;
    }
    input, button, textarea {
      font-family: inherit;
      font-size: 13px;
      color: #000;
      background: #fff;
      border: 1px solid #000;
      box-sizing: border-box;
    }
    input[type="password"], input[type="text"] {
      width: 100%;
      padding: 4px;
    }
    button {
      padding: 4px 12px;
      cursor: pointer;
    }
    button:disabled {
      cursor: wait;
      opacity: 0.6;
    }
    textarea {
      width: 100%;
      height: 180px;
      padding: 4px;
    }
    .meta-line {
      margin-bottom: 4px;
    }
    .field {
      margin-top: 12px;
    }
    .actions {
      margin-top: 10px;
    }
    .error-msg {
      color: #c00;
      margin-top: 10px;
      font-weight: bold;
    }
    .res-section {
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(payloadMeta.title)}</h1>
  <hr>
  <div class="meta-line">形式: ${payloadMeta.type === 'text' ? 'テキスト' : 'ファイル'}</div>
  ${payloadMeta.type === 'file' ? `<div class="meta-line">ファイル名: ${escapeHtml(payloadMeta.filename)}</div>` : ''}
  ${payloadMeta.hint ? `<div class="meta-line">ヒント: ${escapeHtml(payloadMeta.hint)}</div>` : ''}

  <form id="decryptForm" onsubmit="handleDecrypt(event)">
    <div class="field">
      <label for="pwd" style="display:block; margin-bottom: 4px;">パスワード</label>
      <input type="password" id="pwd" autocomplete="current-password" autofocus required />
    </div>
    <div style="margin-top: 6px;">
      <label style="font-size: 12px;">
        <input type="checkbox" id="showPwd" onchange="togglePasswordVisibility()" /> パスワードを表示
      </label>
    </div>
    <div class="actions">
      <button type="submit" id="btnDecrypt">復号</button>
    </div>
  </form>

  <div id="errorBox" class="error-msg" style="display: none;"></div>

  <div id="resultBox" class="res-section" style="display: none;">
    <hr>
    <div>復号完了</div>
    <div id="textContainer" style="display: none; margin-top: 8px;">
      <textarea id="textContent" readonly></textarea>
      <div style="margin-top: 6px;">
        <button type="button" id="btnCopy" onclick="copyDecryptedText()">コピー</button>
      </div>
    </div>
    <div id="fileContainer" style="display: none; margin-top: 8px;">
      <div class="meta-line">ファイル名: <span id="outFilename"></span></div>
      <div style="margin-top: 6px;">
        <button type="button" id="btnDownload" onclick="downloadDecryptedFile()">ダウンロード</button>
      </div>
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
      const chk = document.getElementById('showPwd');
      input.type = chk.checked ? 'text' : 'password';
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
      btnDecrypt.textContent = '復号処理中';

      try {
        const pkgData = JSON.parse(document.getElementById('encrypted-package').textContent);
        const salt = new Uint8Array(base64ToBuffer(pkgData.salt));
        const iv = new Uint8Array(base64ToBuffer(pkgData.iv));
        const ciphertext = base64ToBuffer(pkgData.ciphertext);

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

        const plainBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          aesKey,
          ciphertext
        );

        resultBox.style.display = 'block';
        document.getElementById('decryptForm').style.display = 'none';

        if (pkgData.type === 'text') {
          const text = new TextDecoder('utf-8').decode(plainBuffer);
          document.getElementById('textContainer').style.display = 'block';
          document.getElementById('textContent').value = text;
        } else {
          decryptedFileData = plainBuffer;
          decryptedFilename = pkgData.filename || 'decrypted-file.dat';
          document.getElementById('fileContainer').style.display = 'block';
          document.getElementById('outFilename').textContent = decryptedFilename;
        }
      } catch (err) {
        errorBox.style.display = 'block';
        errorBox.textContent = '復号に失敗しました。パスワードが異なるかデータが破損しています。';
      } finally {
        btnDecrypt.disabled = false;
        btnDecrypt.textContent = '復号';
      }
    }

    function copyDecryptedText() {
      const text = document.getElementById('textContent').value;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btnCopy');
        btn.textContent = 'コピー完了';
        setTimeout(() => { btn.textContent = 'コピー'; }, 1800);
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

export interface GenerateSelfDecryptingOptions {
  type: 'text' | 'file';
  textContent?: string;
  fileData?: ArrayBuffer;
  fileName?: string;
  password: string;
  title?: string;
  hint?: string;
}

export async function generateSelfDecryptingHtml(
  options: GenerateSelfDecryptingOptions
): Promise<string> {
  const data = options.type === 'file' && options.fileData
    ? options.fileData
    : (options.textContent || '');

  return createSelfDecryptingHtml(data, options.password, {
    title: options.title,
    hint: options.hint,
    payloadType: options.type,
    filename: options.fileName,
  });
}
