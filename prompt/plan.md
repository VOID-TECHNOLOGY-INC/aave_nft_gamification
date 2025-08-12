# 実装計画（PR 分割・小さなステップで前進）

この計画は、現在の MVP（Step1/Step2/Step3・Functions・Dashboard 参照）をベースに、PR 単位で安全に前進するためのタスク分解です。各 PR は小さく、テストと受け入れ基準を明確にします。

---

## 前提（現状）

- Borrow
  - Step1: 承認（Approve ERC-721/20）: 実 Tx
  - Step2: 預入（INFTVault.deposit）: 実 Tx
  - Step3: 借入実行（LoanManagerMock.openLoan）: 実 Tx
- Functions: quoteSim（有効 LTV/HF の計算）
- Dashboard: Aave Pool 参照（要 `VITE_AAVE_POOL_ADDRESS_BASE_SEPOLIA`）
- Hosting/Functions デプロイ可能、テスト（Vitest）緑

---

## PR-1: Step3 の仕上げ（入力バリデーション/UX）

- ブランチ: `feat/step3-polish`
- 変更点
  - `OpenLoan.tsx`: フォームのバリデーション（アドレス形式、amount>0、decimals 範囲）
  - 送信中/確定表示の改善、Explorer リンク表示
  - エラーのユーザフレンドリー化（不足変数・未接続ネットワーク）
- テスト（Vitest）
  - `parseUnits` の境界（小数桁溢れ/負数/空文字）
  - 入力ガードの単体
- 受け入れ基準
  - 異常入力で送信不可、正常入力で Tx が発火し、Tx Hash が表示される

---

## PR-2: ERC20 decimals 自動取得

- ブランチ: `feat/openloan-auto-decimals`
- 変更点
  - `OpenLoan.tsx`: `decimals()` 読み取り（viem の `readContract`）で自動設定。手動上書き UI は任意
- テスト
  - `decimals()` 読取成功/失敗時のフォールバック（既定=6）
- 受け入れ基準
  - `currency` 入力後、自動で `decimals` が埋まる。読取失敗時は警告+手動入力可能

---

## PR-3: Repay UI（モック → 実装足場）

- ブランチ: `feat/repay-ui`
- 変更点
  - `pages/Repay.tsx`: ローン ID/返済額入力 → モック送信（将来の `repay(loanId, amount)` に置換予定）
  - Explorer リンク、入力バリデーション
- テスト
  - 入力ガードの単体
- 受け入れ基準
  - UI 遷移とフォーム送信が動作（現時点はモック）。Step3 との整合

---

## PR-4: Dashboard 拡充（Aave 参照）

- ブランチ: `feat/dashboard-aave-metrics`
- 変更点
  - `AaveReserveInfo.tsx`: 利用率 `u`、供給/借入 APR、シンボル表示
  - `Dashboard.tsx`: ウォレット接続時のユーザーデータをカードで整形
- テスト
  - 計算関数（利用率 = totalDebt / totalLiquidity）の単体
- 受け入れ基準
  - Reserve とユーザーデータが視認性良く表示される

---

## PR-5: ERC-721 正式対応の簡易切替（任意）

- ブランチ: `feat/nft-erc721-switch`
- 変更点
  - `DepositVault`/`Approve721`: ERC-721 前提のラベル・ヘルプを明記
  - README: ERC-20 流用時の確認手段（balanceOf）と、ERC-721 時の ownerOf の両方を説明
- テスト
  - なし（UI 調整）
- 受け入れ基準
  - README/ヘルプが誤解なく利用できる

---

## PR-6: Aave 連携の足場（LiquidityPool アダプタ Skeleton）

- ブランチ: `feat/liquiditypool-skeleton`
- 変更点
  - `web/src/components`: Supply/Withdraw（UI のみ）を追加（将来 `IPool.supply/withdraw` 接続）
  - 設定: 供給対象アセット/Pool/AddressesProvider の入力欄
- テスト
  - 入力ガードの単体
- 受け入れ基準
  - UI から必要パラメータが入力でき、送信ボタンが活性/非活性制御される

---

## PR-7: Functions 拡張（評価 API の帯域/検証）

- ブランチ: `feat/functions-hardening`
- 変更点
  - `quoteSim` に簡単な入力検証（範囲/型）を追加
  - レート制限や CORS の明示設定
- テスト
  - Functions のユニット（型+境界値）※ローカル or エミュレータ
- 受け入れ基準
  - 異常入力で 400、正常で 200 + JSON

---

## PR-8: CI（GitHub Actions）

- ブランチ: `ci/vitest-build`
- 変更点
  - `web` の `npm ci && npm run build && npm run test` を実行するワークフロー
  - `functions` の `npm ci && npm run build` を実行
- テスト
  - PR で CI が走り、緑になること
- 受け入れ基準
  - main/PR で自動チェックが実行される

---

## PR-9: UX 改善（Explorer リンク/ネットワークガード）

- ブランチ: `feat/ux-explorer-guards`
- 変更点
  - すべての Tx 出力に Base Sepolia Explorer へのリンク
  - ネットワークが Base Sepolia 以外のとき、明示アラート
- テスト
  - URL 生成関数の単体
- 受け入れ基準
  - すべての Tx UI で Explorer にワンクリックで遷移可能

---

## PR-10: ドキュメント整備

- ブランチ: `docs/update`
- 変更点
  - README: 最新手順/トラブルシュート（ERC-20/721 差異、Explorer の見方）
  - `doc/` の仕様参照リンク追補
- テスト
  - なし
- 受け入れ基準
  - 新規参加者が README だけで動作確認できる

---

## 運用ルール（推奨）

- ブランチ命名: `feat/*`, `fix/*`, `docs/*`, `ci/*`
- PR テンプレ: 目的/変更点/テスト/受け入れ基準/スクショ
- デプロイ: マージ後に `npm run build` → `firebase deploy --only hosting`（Functions 変更時は `--only functions,hosting`）
- テスト: 小さな変更でも Vitest を追加し、赤 → 緑の最小サイクルで前進
