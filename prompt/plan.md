# 実装計画（PR 分割・小さなステップで前進）

この計画は、現在の MVP（Step1/Step2/Step3・Functions・Dashboard 参照）をベースに、PR 単位で安全に前進するためのタスク分解です。各 PR は小さく、テストと受け入れ基準を明確にします。評価アルゴリズム（`doc/algorithm.md`）の「MVP 範囲」をまず実装し、UI/Functions から段階的に統合します。フロントエンドの体験は `doc/frontend.md` の仕様に準拠して刷新します。

---

## 前提（現状）

- Borrow
  - Step1: 承認（Approve ERC-721/20）: 実 Tx
  - Step2: 預入（INFTVault.deposit）: 実 Tx
  - Step3: 借入実行（LoanManagerMock.openLoan）: 実 Tx
- Functions: quoteSim（有効 LTV/HF の計算・モック）
- Dashboard: Aave Pool 参照（要 `VITE_AAVE_POOL_ADDRESS_BASE_SEPOLIA`）
- Hosting/Functions デプロイ可能、テスト（Vitest）緑

---

## ゴール（当面のMVP）
- `algorithm.md` の「MVP 範囲」に沿い、オフチェーン評価 API を Functions で提供（フロアTWAP/近傍履歴/簡易流動性/ボラ/ウォッシュ疑義）。
- UI を `doc/frontend.md` に沿ってワンページ・自動進行の体験へ刷新。評価値（CollateralValue）・Confidence・有効 LTV・HF を可視化し、Smart CTA と安全ガードに反映。
- 将来のオンチェーン統合に備え、EIP-712 署名ペイロードと署名/検証基盤（オフチェーン）を準備。

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
-  計算関数（利用率 = totalDebt / totalLiquidity）の単体
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

## PR-8: CI（GitHub Actions） [Done]

- ブランチ: `ci/vitest-build`
- 変更点
  - `web` の `npm ci && npm run build && npm run test` を実行するワークフロー
  - `functions` の `npm ci && npm run build` を実行
- テスト
  - PR で CI が走り、緑になること
- 受け入れ基準
  - main/PR で自動チェックが実行される（達成）

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

# ここから評価アルゴリズム統合（新規）

## PR-11: 評価 API MVP（Functions 実装）

- ブランチ: `feat/functions-oracle-v1`
- 変更点
  - `functions`: `POST /api/evaluate` を追加
    - 入力: `collection`, `tokenId`
    - 出力: `collateralValueUSD_1e8`, `confidenceBP`, `L_bp`, `V_bp`, `W_bp`, `validUntil`, `circuitFlags`
  - 算出は `doc/algorithm.md` の「MVP 範囲」に準拠（フロアTWAP/近傍履歴/簡易 L/V/W、min 合成）
  - 入力検証・CORS・レート制限
- テスト
  - 正常/異常のユニット、丸め（1e8）と期限ロジック
- 受け入れ基準
  - 有効入力で安定した JSON を返し、無効入力は 400

## PR-12: Web 統合（UI刷新＋評価反映）

- ブランチ: `feat/web-oracle-integration`
- 変更点
  - `Borrow.tsx` を分割: `EvaluationBanner` / `BorrowForm` / `BorrowChecklist` / `SmartActionPanel`
  - `Stepper` を撤廃し、Smart CTA（接続→承認→預入→借入）に自動切替
  - `evaluate`（将来API/当面は `quoteSim`）の値を UI に反映（`CollateralValue`/`effectiveLTV`/`maxBorrow`/`HF`）
  - 評価TTLと新鮮度表示（例: 「3分前に更新」）
- テスト
  - API 成功/失敗モック、LTV/HF の計算単体、Smart CTA の分岐ユニット
- 受け入れ基準
  - 評価値が UI に反映され、危険時は主ボタンが無効化される。手動「次へ」は存在しない

## PR-13: サーキットブレーカー/フェイルクローズ

- ブランチ: `feat/oracle-guards`
- 変更点
  - `circuitFlags` に応じて UI で新規借入を強制停止
  - 未更新時の逓減（Decay）を UI 文言に反映
- テスト
  - Flags 切替で UI の動作が変わる
- 受け入れ基準
  - 緊急時に新規借入が抑止される

## PR-14: 署名ペイロード（EIP-712）と署名発行（オフチェーン）

- ブランチ: `feat/functions-signing`
- 変更点
  - `algorithm.md` の EIP-712 定義に沿い、Functions 側で署名発行（署名鍵は環境変数）
  - 応答に `typedData`, `signature` を付与（検証はクライアント/将来のコントラクトで）
- テスト
  - 署名検証（公開鍵一致）、有効期限/nonce
- 受け入れ基準
  - 応答の署名が検証可能

## PR-15: モニタリング/回帰データ

- ブランチ: `feat/oracle-monitoring`
- 変更点
  - Cloud Functions のログ/メトリクス（成功率、P95レイテンシ）
  - `doc/test_schema.md` に評価サンプルを追記し、Vitest で回帰比較
- テスト
  - サンプル入力集合での安定性（閾値内）
- 受け入れ基準
  - 意図せぬズレを検知可能

---

## 運用ルール（推奨）

- ブランチ命名: `feat/*`, `fix/*`, `docs/*`, `ci/*`
- PR テンプレ: 目的/変更点/テスト/受け入れ基準/スクショ
- デプロイ: マージ後に `npm run build` → `firebase deploy --only hosting`（Functions 変更時は `--only functions,hosting`）
- テスト: 小さな変更でも Vitest を追加し、赤 → 緑の最小サイクルで前進


---

# UI/UX 刷新（`doc/frontend.md` 準拠の追加PR）

## PR-16: SmartActionPanel（自動切替と無効化ロジック）

- ブランチ: `feat/ui-smart-cta`
- 変更点
  - Smart CTA 実装（接続→承認→預入→借入の自動切替）
  - 無効化条件の実装（評価TTL超過/`circuitFlags`/`Confidence`/`L`/`V`/金額上限/ネットワーク不一致）
  - 遷移理由のミニテキスト表示（フェードイン）
- テスト
  - 分岐のユニットテスト、ガード条件の境界値
- 受け入れ基準
  - 状態に応じてボタンのラベル/無効化が正しく切り替わる

## PR-17: BorrowChecklist（状態検出＋ポーリング＋アニメーション）

- ブランチ: `feat/ui-checklist`
- 変更点
  - 承認/預入/評価/リスクの状態検出と 30s ポーリング
  - 完了時のアニメーション、関連項目のハイライト
  - `localStorage` に直近 Tx を保存し、再訪時に復元
- テスト
  - 取得関数のモックとポーリングの動作検証
- 受け入れ基準
  - 他デバイス操作後も一定時間内にUIが最新状態へ同期する

## PR-18: ガード閾値と設定駆動（コンフィグ化）

- ブランチ: `feat/ui-guards-config`
- 変更点
  - `doc/frontend.md` の推奨初期値（Confidence/L/V/評価TTL/HF_post/金額安全係数）を定数化
  - 機能フラグ/閾値を `config.ts` から参照できるようにする
- テスト
  - 閾値変更時のガード挙動のユニット
- 受け入れ基準
  - 閾値変更が UI の無効化/警告に即時反映される

## PR-19: ガス見積・USD表示・シミュレーション

- ブランチ: `feat/ui-gas-estimate`
- 変更点
  - `estimateGas` と（可能なら）`simulateContract` による事前検証
  - USD 換算のガス目安表示、失敗時の具体的文言
- テスト
  - 見積成功/失敗のモックテスト
- 受け入れ基準
  - 送信前に推定手数料が表示され、失敗時は明確な理由が表示される

## PR-20: i18n とアクセシビリティ改善

- ブランチ: `feat/ui-i18n-a11y`
- 変更点
  - 文言のキー化と `ja` 既定、`en` 切替の骨子
  - フォーカス制御/aria-live/ランドマーク整理
- テスト
  - 文言切替のスナップショット、Tab 移動の基本チェック
- 受け入れ基準
  - 鍵となる画面で読み上げとフォーカス移動が適切に機能

## PR-21: 競合状態対策（AbortController/RequestId）

- ブランチ: `feat/ui-concurrency`
- 変更点
  - `evaluate` リクエストに `requestId` を付与し、最新のみ採用
  - `AbortController` によるキャンセル
- テスト
  - 素早い入力変更時に古い結果が反映されないこと
- 受け入れ基準
  - 高頻度入力でも UI が正しい最新状態を維持

## PR-22: E2E とドキュメント追補

- ブランチ: `test/e2e-and-docs`
- 変更点
  - E2E: 基本フロー/TTL超過/フラグ停止/既承認スキップ等
  - `doc/frontend.md` の図/ガイドに反映された差分の最終確認
- テスト
  - 主要パスのE2E（Playwright等）
- 受け入れ基準
  - E2E 緑、ドキュメントと実装の整合が取れている


