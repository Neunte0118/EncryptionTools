# Local Crypto Vault & Signature Studio

ブラウザ標準の **Web Crypto API (`window.crypto.subtle`)** のみを用いた、完全クライアント側（ゼロ通信）で動作する暗号化・電子署名・ハッシュ確認・単一ファイル鍵管理ツールです。外部の暗号ライブラリを一切含みません。

---

## 外部ライブラリと独自実装の透明性

本プロジェクトではセキュリティと自立性を最優先とし、暗号コア機能や分散アルゴリズムには外部暗号ライブラリを一切使用していません。採用している外部ライブラリの目的とバージョンは以下の通り完全に明示されています。

### 1. コアアルゴリズムの実装方式（外部暗号ライブラリ不使用）

| 機能 | 実装方式 | 外部暗号ライブラリ |
| :--- | :--- | :--- |
| **シャミアの秘密分散法 (SSS)** | **完全自前実装 (`src/utils/shamirUtils.ts`)**<br>ガロア体 $GF(2^8)$ 演算（AESと同じ既約多項式 $x^8 + x^4 + x^3 + x + 1$）、ラグランジュ補間、CRC32整合性検証、不正シェア検知まで純粋なTypeScriptで独自実装 | **なし (0件)** |
| **暗号化・復号・電子署名・ハッシュ** | **ブラウザ標準 Web Crypto API (`window.crypto.subtle`)**<br>AES-256-GCM, RSA-OAEP, RSA-PSS, ECDSA, SHA-256/512 等 | **なし (0件)** |
| **ステガノグラフィ (LSB隠蔽)** | **HTML5 Canvas API + Compression Streams API**<br>ピクセルのRGBA各チャンネルの最下位ビット操作とGzip自動圧縮 | **なし (0件)** |
| **暗号論的乱数・UUID生成** | **ブラウザ標準 `crypto.getRandomValues()`** | **なし (0件)** |

### 2. 使用している外部 npm パッケージ一覧とその用途

| パッケージ | バージョン | 主な用途・採択理由 |
| :--- | :--- | :--- |
| `qrcode` (`@types/qrcode`) | `^1.5.4` | 分散シェアの紙印刷・他端末共有用 **QRコード画像描画**（※暗号・分散処理自体は不使用） |
| `pdf-lib` | `^1.17.1` | PDF ファイルのメタデータ読み取り・サニタイズ（削除）処理 |
| `browser-id3-writer` | `^6.4.0` | MP3 音声ファイルの ID3v2.3 タグ更新・編集処理 |
| `piexifjs` | `^1.0.6` | JPEG 画像ファイルの EXIF メタデータ解析・削除処理 |
| `lucide-react` | `^0.546.0` | UI アイコン表示 |
| `motion` | `^12.23.24` | UI インタラクティブアニメーション |
| `vite-plugin-pwa` | `^2.0.0` | オフライン動作および PWA (Service Worker / Manifest) ビルド |
| `tailwindcss` | `^4.3.3` | UI スタイリング |

---

## 主な機能

1. **単一ファイルによる鍵管理 (Key Vault)**
   - タイトル・メモ・アルゴリズム情報・公開鍵（SPKI PEM）・秘密鍵（PKCS#8 PEM）・共通鍵を一元管理。
   - 単一の JSON ファイルとしてインポート・追記・編集・削除・エクスポートが可能。
   - 秘密鍵はデフォルトで伏せ字（`••••••••`）保護され、「秘密鍵を表示」ボタンを押したときのみ開示。
   - 各種鍵やハッシュ値、暗号文はテキスト枠をクリックするだけで即座にコピー可能。

2. **デジタル署名・検証 (Signature Studio)**
   - **RSA-PSS** (SHA-256 / SHA-384 / SHA-512)
   - **ECDSA** (P-256 / P-384 / P-521)
   - **RSASSA-PKCS1-v1_5**
   - テキスト入力およびファイルドラッグ＆ドロップ（バイナリ直接署名）に対応。
   - Base64 / Hex 形式の署名生成、照合合否判定（Pass / Fail）。

3. **ハッシュ計算・整合性確認 (Hash Tool)**
   - SHA-256, SHA-512, SHA-384, SHA-1。
   - 初期値として空文字 `""` の標準ハッシュ値を自動計算・表示。
   - ファイルのドラッグ＆ドロップ計算および照合用ハッシュ（Expected Checksum）との自動突き合わせ。

4. **ファイル暗号化・復号 & ハイブリッド暗号 (File Encryption)**
   - **ハイブリッド暗号 (AES-256-GCM + RSA-OAEP)** [推奨]:
     - 大容量ファイル（PDF, ZIP, 画像等）もAESで高速暗号化し、ワンタイム共通鍵を受取人のRSA公開鍵で安全にカプセル化。
     - 復号時は受取人のRSA秘密鍵でワンタイム鍵を復号し、元ファイル名・拡張子のまま完全復元ダウンロード。
   - **AES-256-GCM (パスワード方式)**:
     - パスワードとPBKDF2（100,000回イテレーション＋ランダムソルト）による暗号化。
   - **AES-256-GCM (共通鍵方式)**:
     - 事前共有された256-bit共通鍵を用いた直接暗号化。
   - 暗号化ファイル（`.enc`）のフォーマット自動判別機能を搭載。

5. **テキスト暗号化・復号・鍵共有 (Text Encryption & Key Exchange)**
   - **RSA-OAEP** によるテキスト公開鍵暗号化と秘密鍵復号。
   - **AES-GCM (256-bit)** 認証付き共通鍵暗号化/復号。
   - **ECDH** による楕円曲線鍵共有（共有シークレット導出）。

6. **鍵ペア生成 (Key Generator)**
   - RSA 2048/3072/4096-bit, ECC (P-256/P-384/P-521), AES 128/256-bit。
   - 生成結果から直接タイトルとメモを付けて鍵管理ファイルへ追記可能。

7. **暗号論的乱数・正規表現・UUID生成 (CSPRNG Generator)**
   - **正規表現・パターン指定**: `[A-Za-z0-9]{32}` や `sk_live_[0-9a-zA-Z]{32}` など、任意の正規表現構文・文字種から暗号学的に安全（バイアスなし）に乱数文字列を生成。
   - **UUID v4**: RFC 4122 準拠の暗号論的一意識別子（大文字/小文字、ハイフン有無切り替え、一括生成）。
   - **生乱数バイト**: 16〜128バイトのランダムバイナリ（Hex / Base64）生成。
   - プリセット搭載（UUID v4、APIシークレット、高強度パスワード、6桁PIN、Base58、ライセンスキー等）。
   - 全結果はクリックするだけで即座にコピー可能。

---

## GitHub Pages への公開手順 (GitHub Actions)

本リポジトリにはすでに GitHub Actions ワークフロー (`.github/workflows/deploy.yml`) と `package-lock.json` が設定されています。

### 手順

1. **リポジトリのプッシュ**
   - 本プロジェクトの全ファイルを GitHub のリポジトリにプッシュします。
   ```bash
   git add .
   git commit -m "Initial release of Local Crypto Vault"
   git push origin main
   ```

2. **GitHub Pages の設定を変更（重要）**
   - GitHub 上のリポジトリページを開きます。
   - 上部メニューの **「Settings」** タブをクリック。
   - 左側サイドバーの **「Pages」** を選択。
   - **「Build and deployment」** の **「Source」** ドロップダウンを、デフォルトの `Deploy from a branch` から **`GitHub Actions`** に切り替えます。

3. **自動ビルド＆公開**
   - `main` (または `master`) ブランチへプッシュすると、GitHub Actions が自動実行されます。
   - リポジトリの **「Actions」** タブで `Deploy to GitHub Pages` ワークフローの進行状況を確認できます。
   - 完了すると、**Settings > Pages** または Actions 完了画面に公開 URL（例: `https://<ユーザー名>.github.io/<リポジトリ名>/`）が表示されます。
   - `vite.config.ts` で `base: './'` が設定されているため、サブディレクトリ配下のパスでもスタイルやスクリプトが正常に読み込まれます。

---

## ローカル開発手順

```bash
# 依存関係のインストール (package-lock.json と完全同期)
npm ci

# パッケージを追加・更新した場合の lockfile 同期
npm install

# 開発サーバー起動 (ポート 3000)
npm run dev

# 型チェック
npm run lint

# 本番ビルド
npm run build
```

> **注意 (CI/CDで `npm ci` を実行する場合)**:  
> `npm ci` は `package.json` と `package-lock.json` のバージョン・依存ツリーが1行の狂いもなく完全一致している必要があります。依存パッケージを追加した後は必ず `npm install` を実行し、生成された `package-lock.json` を含めて git commit してください（現在本リポジトリの `package-lock.json` は最新状態に同期済みです）。

