# Aave NFT Lend + Gamification (MVP)

Aave v3 を運用先に用いながら、NFT（本 MVP ではテスト簡略のため ERC-721/20 いずれでも可）を担保として預け入れ、借入フローを体験できる Web アプリ（Firebase Hosting）です。評価ロジックや Aave 連携の参照表示、返済ゲーミフィケーションに拡張可能な構成を採用しています。

## 構成

```
aave-nft-gami-lend/
├─ doc/                   # 仕様・アルゴリズム・テスト方針
├─ web/                   # フロント（Vite + React + TypeScript）
│  ├─ src/
│  │  ├─ components/     # UI/Txコンポーネント（Approve / Deposit / OpenLoan など）
│  │  ├─ hooks/          # Aave Pool接続フック
│  │  ├─ lib/            # 見積ロジック（effectiveLTV/HF）
│  │  ├─ pages/          # Home / Borrow / Dashboard / Repay
│  │  └─ services/       # Functionsのクライアント
│  ├─ index.html
│  └─ vite.config.ts
├─ functions/             # Firebase Functions（評価シミュレーション等のAPI）
├─ firebase.json          # Firebase Hosting/Functions 設定
├─ .firebaserc            # Firebase プロジェクト設定
└─ storage.rules          # Firebase Storage ルール（MVPはreadのみ）
```

## 前提

- Node.js 18+ / npm
- Firebase CLI
- ウォレット（Base Sepolia に接続可能 / 少額 ETH）

## セットアップ

1. 依存インストール

```bash
# フロント
cd web
npm i

# Functions（任意）
cd ../functions
npm i
```

2. 環境変数（web/.env.local）

```bash
# WalletConnect（RainbowKit 用）
VITE_WALLETCONNECT_PROJECT_ID=xxxxxxxxxxxxxxxx

# Aave（参照用。Step3では未必須）
VITE_AAVE_POOL_ADDRESS_BASE_SEPOLIA=0x...

# Firebase（Functionsの呼び出しに使用）
VITE_FIREBASE_PROJECT_ID=aave-nft-gamification
VITE_FIREBASE_REGION=us-central1

# プロトコル
# 事前に Base Sepolia に Vault（INFTVault）/ LoanManager（Mock可）をデプロイしておきます
VITE_VAULT_ADDRESS=0x...               # 預入先コントラクト
VITE_LOAN_MANAGER_ADDRESS=0x...        # 借入実行先コントラクト
```

3. 開発サーバ

```bash
cd web
npm run dev
```

4. テスト（フロントの見積ロジック）

```bash
cd web
npm run test
```

## ビルド & デプロイ

- フロントのビルド

```bash
cd web
npm run build
```

- Hosting へデプロイ（プロジェクトルート）

```bash
firebase deploy --only hosting
```

- Functions（任意）

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

## 使い方（MVP）

1. Home

- ウォレット接続（右上）

2. Borrow（借入フロー）

- 見積（ローカル/Functions）: effective LTV / HF を計算
- Step1: 承認
  - `NFTコントラクト` と `tokenId` を入力
  - 承認先は `VITE_VAULT_ADDRESS`
- Step2: 預入
  - `deposit(collection, tokenId)` を送信
  - 以降、`ownerOf(tokenId)` が `Vault` アドレスになる（ERC-721 の場合）
- Step3: 借入実行
  - `openLoan(collection, tokenId, amount, currency)` を送信
  - 通貨の `decimals` に合わせ `amount` を `parseUnits` でパース（例: USDC=6）

3. Dashboard

- ウォレット/Pool の状態、リザーブ金利の読取（Aave Pool アドレス設定が必要）

## Base Sepolia について

- ネットワーク情報
  - RPC: `https://sepolia.base.org`
  - Chain ID: `84532`
  - 通貨: `ETH`
- ガス（テスト ETH）
  - ファウセットから入手（無料）。承認/預入/借入 Tx に使用します。

## よくある質問（FAQ）

- どのアドレスを設定する？
  - `VITE_VAULT_ADDRESS`: INFTVault（預入先コントラクト）
  - `VITE_LOAN_MANAGER_ADDRESS`: LoanManager（借入実行コントラクト。Mock 可）
- エクスプローラで確認できない
  - 本番(Base Mainnet)ではなく、Base Sepolia（`sepolia.basescan.org`）で確認してください。
- 進行できない（次へが押せない）
  - ウォレット接続が必要です（Step1/2）。Step3 は将来的に Aave の設定も必要になります。

## セキュリティ

- 本リポジトリは MVP です。実資金の利用や本番デプロイ時には監査・権限設計・パラメータ管理（Timelock/Guardian）等の安全対策を必ず実施してください。

## ライセンス

- 本リポジトリ内のコードは各ファイルヘッダ/サブプロジェクトの規約に従います。
