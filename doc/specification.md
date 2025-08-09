# 仕様書：Aave連携「NFT担保ローン＋AI評価」×「返済ゲーミフィケーション」DApp

最終更新：2025-08-09（Asia/Tokyo）

---

## 0. 概要

* **目的**：Aave v3 互換の資産運用・流動性を活用しつつ、ユーザーが **NFT を担保**に **安定通貨を借入**できるレイヤーを提供。NFT評価は **AI＋オンチェーン検証**（オラクル／署名）で安全に反映。
* **新規性**：

  1. **AI評価 × 信頼度ベースLTV**（可変ヘアカット）
  2. **返済ゲーミフィケーション**（SBT/1155バッジ、手数料割引、ミッション）
  3. **自動ステーキング／Aave運用**でスプレッド最適化
* **Aaveへの組み込み形態**：本プロトコルは **上位レイヤー**（アダプタ）として動作。LPが供給した安定通貨の遊休分を Aave v3 へ供給して **ベース利回り**を獲得、貸出は当レイヤーが行う（NFTは当レイヤーでカストディ／清算管理）。Aaveコアコントラクトは **改変不要**。
* **対応チェーン**：EVM（Ethereum L2 / L3 優先、例：Arbitrum / Base / OP）。

---

## 1. 全体アーキテクチャ

```
[User Wallet]
   |  (ERC721 approve / Loan actions)
   v
[NFTVault] <----> [ValuationOracle (on-chain)]
   |                        ^
   |                        | signed price feed (Chainlink Functions/CCIP)
   v                        |
[LoanManager]  <---------[AI Valuation Service (off-chain)]
   | \
   |  \  borrows/lends
   |   \
   v    v
[LiquidityPool] <----> [Aave v3 Pool]  (reserve deployment / withdrawals)
   ^
   |
[LPs (USDC/USDT/DAI)]
```

* **NFTVault**：ユーザーの NFT をエスクロー。コレクションごとの許可・属性検査、清算時にオークションへ。
* **ValuationOracle**：オンチェーン価格決定モジュール。AIサーバーの評価を署名／Chainlink Functions で搬入。複数系統（AI、フロア価格、AMM/AMM-TWAP）を集約。
* **LoanManager**：審査・LTV・金利・清算ロジック・ポジション状態遷移を管理。
* **LiquidityPool**：安定通貨のプール。**利用率ベース**の可変貸出金利。**余剰流動性はAave v3へ供給**してベース利回り（aTokenリワード含む）を獲得。
* **GamificationManager**：返済実績を SBT/ERC-1155 バッジで付与、手数料割引/金利ブーストを適用。

---

## 2. 資産とトークン

* **担保**：ERC-721（ホワイトリスト制、後述のリスクパラメータ要件を満たしたコレクション）
* **借入通貨**：USDC/USDT/DAI など（チェーン事情で選択）
* **LPトークン**：`lpToken`（ERC-20）。プールシェアを表す。
* **SBT/バッジ**：`RepBadge`（ERC-1155 SBT：転送不可）

  * On-time Streak（連続期日返済）
  * Liquidation-Free（清算ゼロ月）
  * Early Repay（早期完済）
  * Governance Contributor（提案/投票参加）

---

## 3. 価格評価（AI × オラクル）

### 3.1 評価パイプライン

1. **オフチェーンAI評価**

* 特徴量：コレクション名、トレイト、最近の成約/上場履歴、マーケット流動性（深さ/スプレッド）、ウォッシュ取引検出、ボラ指標。
* 出力：`fair_value`, `confidence (0~1)`, `liquidity_score (0~1)`, `volatility_score (0~1)`。

2. **多系統フェイルセーフ**

* **Floor Oracle**（オンチェーンTWAP/Chainlink Data Streams/RWA価格プロキシ）
* **Trait Oracle**（属性ベース類似トークン近傍の分位点価格）
* **Circuit Breaker**（過去X時間/Y日で±Z%超の変動ならリスケ/手動審査）

3. **オンチェーン反映**

* AIサーバーは評価結果に対して**署名**（EIP-712）。
* **Chainlink Functions/CCIP**で `ValuationOracle` にポスト。
* オラクルは複数ソースを**合成**：
  `price = min( AI_price * α(confidence,liquidity,volatility), floor_price * β )`

  * 例：`α = 0.6 + 0.4*confidence - 0.2*volatility + 0.2*liquidity` を \[0.4, 1.0] へクリッピング
  * `β` は安全係数（例：0.9）

### 3.2 LTVとヘアカット

* `baseLTV`（コレクション毎）× `adj = f(confidence, liquidity, volatility)`
* 例：`effectiveLTV = baseLTV * min( confidence + 0.2*liquidity - 0.2*volatility, 1.0 )`
* ガード：`effectiveLTV ∈ [minLTV, maxLTV]`（例：0.15〜0.45）

---

## 4. ユーザーフロー

### 4.1 借入

1. ユーザー：`NFTVault` に `approve` → `deposit(nft, tokenId)`
2. `ValuationOracle`: 署名付き価格を取り込み、`effectiveLTV` 計算
3. ユーザー：`LoanManager.openLoan(nft, tokenId, amount, currency)`
4. `LoanManager`: 借入上限（`amount ≤ value * effectiveLTV`）とプール流動性・健全性を検査
5. `LiquidityPool`: 通貨送付（余剰がAave供給中なら一部引出）
6. `GamificationManager`: 「初回借入」ミッション付与

### 4.2 返済

* `repay(amount)`：利息→元本の順に清算
* 期日遵守で SBT バッジ・手数料割引（翌ローン適用）
* 早期完済で `Early Repay` バッジ

### 4.3 清算

* `healthFactor < 1.0` で清算対象
* **Dutch Auction**（Seaport/Blur統合） or **OTC バックストップ**
* 競売収益 → 元本/利息/ペナルティ/清算人インセンティブ → 余剰は借主へ

---

## 5. 金利・手数料

* **借入金利（変動）**：`kink` 付き利用率モデル（Compound/Aave風曲線）
* **オラクル料**：評価更新ごとに少額固定 + ガス相当
* **清算ペナルティ**：健全性に応じた段階制
* **ゲーミフィケーション割引**：最大 `-50 bps` まで（バッジ階層に応じ適用）

---

## 6. ガバナンス

* 初期：マルチシグ（リスクパラメータ、コレクション許可、清算バックストップ設定）
* 移行：`Governor`（ERC-20/721ベース）
* パラメータ：`baseLTV`, `minConfidence`, `auctionStep`, `oracleQuorum`, `backstopCap` など

---

## 7. コントラクト仕様（主要IF）

### 7.1 `INFTVault.sol`

```solidity
interface INFTVault {
    event Deposited(address indexed user, address indexed collection, uint256 tokenId);
    event Withdrawn(address indexed user, address indexed collection, uint256 tokenId);
    event Seized(address indexed loan, address indexed collection, uint256 tokenId);

    function deposit(address collection, uint256 tokenId) external;
    function withdraw(address collection, uint256 tokenId) external; // only if no debt
    function lockToLoan(address collection, uint256 tokenId, address loan) external; // LoanManager only
    function seize(address collection, uint256 tokenId, address to) external; // LoanManager only
    function isLocked(address collection, uint256 tokenId) external view returns (bool);
}
```

### 7.2 `IValuationOracle.sol`

```solidity
interface IValuationOracle {
    struct Valuation {
        uint256 price;        // in 1e8 USD
        uint16  confidenceBP; // 0-10000
        uint16  liquidityBP;  // 0-10000
        uint16  volatilityBP; // 0-10000
        uint64  validUntil;   // timestamp
        bytes   sig;          // EIP-712 signature bundle
    }

    event ValuationPosted(address indexed collection, uint256 indexed tokenId, uint256 price, uint64 validUntil);
    event SourceConfigUpdated(bytes32 indexed key, bytes data);

    function getPrice(address collection, uint256 tokenId) external view returns (uint256 price1e8);
    function getParams(address collection, uint256 tokenId) external view returns (uint16 conf, uint16 liq, uint16 vol);
    function postValuation(address collection, uint256 tokenId, Valuation calldata v) external;
}
```

### 7.3 `ILoanManager.sol`

```solidity
interface ILoanManager {
    struct Loan {
        address borrower;
        address collection;
        uint256 tokenId;
        address currency;
        uint256 principal;
        uint256 ratePerYearBP;
        uint64  startAt;
        uint64  dueAt;
        uint8   state; // 0=Active,1=Repaid,2=Default,3=Liquidating
    }

    event LoanOpened(uint256 indexed loanId, address indexed borrower, address collection, uint256 tokenId, uint256 amount);
    event Repaid(uint256 indexed loanId, uint256 amount, uint256 interestPaid);
    event Defaulted(uint256 indexed loanId);
    event Liquidated(uint256 indexed loanId, uint256 proceeds, address liquidator);

    function openLoan(address collection, uint256 tokenId, uint256 amount, address currency) external returns (uint256 loanId);
    function repay(uint256 loanId, uint256 amount) external;
    function currentHF(uint256 loanId) external view returns (uint256 hf1e18);
    function triggerDefault(uint256 loanId) external;
    function liquidate(uint256 loanId, bytes calldata auctionData) external;
}
```

### 7.4 `ILiquidityPool.sol`

```solidity
interface ILiquidityPool {
    event Supplied(address indexed user, address indexed asset, uint256 amount, uint256 minted);
    event Withdrawn(address indexed user, address indexed asset, uint256 amount, uint256 burned);
    event DeployedToAave(address indexed asset, uint256 amount);
    event PulledFromAave(address indexed asset, uint256 amount);

    function supply(address asset, uint256 amount) external returns (uint256 lpMinted);
    function withdraw(address asset, uint256 lpAmount) external returns (uint256 amountOut);

    function borrow(address asset, uint256 amount, address to) external; // LoanManager only
    function repayFrom(address asset, uint256 amount, address from) external; // LoanManager only

    function utilization(address asset) external view returns (uint256 u1e18);
}
```

### 7.5 `IGamificationManager.sol`

```solidity
interface IGamificationManager {
    event BadgeMinted(address indexed user, uint256 indexed badgeId, uint256 amount);
    event DiscountApplied(uint256 indexed loanId, uint16 bp);

    function onRepay(uint256 loanId, address user, uint256 repaidAmount, bool onTime) external;
    function discountBP(address user) external view returns (uint16);
}
```

---

## 8. 金利・清算ロジック（擬似コード）

### 8.1 健全性（HF）

```
value = Oracle.price(collection, tokenId) * safetyFactor(conf, liq, vol)
debt  = principal + accruedInterest
HF    = (value * effectiveLTV / debt)
```

### 8.2 清算条件

* `HF < 1.0` または `dueAt < now` で `Default` 遷移
* 清算方式：

  * オランダ式（開始価格 = `value * (1 + prem)`、時間で逓減）
  * 最低落札価格 = `debt * (1 + penalty)`
  * 未達時：バックストップが買い取り（上限 `backstopCap`）

---

## 9. Aave v3 連携詳細

* **デプロイ/引出**：`LiquidityPool` が aToken を取得・保有。
* **方針**：

  * **ベース利回り**確保：未貸出の安定通貨は Aave へ供給。
  * **流動性ニーズ**：借入要求 or 返却に応じて aToken を償還。
  * **リスク**：当レイヤーは Aave の与信に依存せず、NFT与信はオンレイヤーで完結。Aaveは**運用先**。
* **実装要点**：

  * Aave `IPool` / `IPoolAddressesProvider` を参照
  * 失敗時リトライ、スリッページ/ヘアカット、`EModeCategory` は利用資産設定に準拠
  * リワード（stkAAVE など）は `treasury` に集約→LP/保険準備金へ配分

---

## 10. コレクション上場ポリシー（リスク管理）

* **必須条件**

  * 90日以上の取引履歴、週次出来高閾値
  * 上位マーケット（Blur/Opensea 等）での上場分散
  * ウォッシュ取引比率が基準以下（AI検出）
* **パラメータ**

  * `baseLTV`（例：BlueChip 0.4、新興 0.2）
  * `minConfidence`（例：0.6）
  * `maxVolatility`（例：0.7）
  * `refreshInterval`（例：1〜6h）
* **停止ガード**

  * 取引停止/凍結、コレクション契約アップグレード検知時に**新規貸出停止**、既存は段階的縮減

---

## 11. ゲーミフィケーション設計

* **SBT/1155 バッジ**

  * `OnTime xN`：N回連続で期日返済
  * `NoLiquidation xM`：Mヶ月清算ゼロ
  * `Community`：ガバナンス投票、フォーラム貢献
* **特典**

  * 手数料/金利割引（最大 50 bps）
  * 早期返済でポイント → 次回評価手数料相殺
  * ミッション（週次/月次）達成で追加割引
* **悪用対策**

  * スマーフィング検知（同一端末/資金フロー相関）
  * バッジは**Soulbound**（譲渡不可）、特典は本人限定

---

## 12. セキュリティと監査

* **設計**

  * 最小権限：`LoanManager` のみが `NFTVault.seize`／`LiquidityPool.borrow` を呼べる
  * リエントランシ防止、チェック・エフェクト・インタラクション徹底
  * オラクル署名の**ドメイン分離**／リプレイ防止（`validUntil`,`nonce`）
* **監査・フォーマル**

  * Slither / Echidna / Foundry fuzz
  * 主要ステートマシン（Loan lifecycle）の形式検証
* **運用**

  * **Guardian**（緊急停止）
  * **Timelock**（重要パラメータ変更）
  * **バグバウンティ**（Immunefi 相当）

---

## 13. アップグレード戦略

* **Proxy**：UUPS もしくは Transparent Proxy
* **データ分離**：Vault と Loan 台帳は別コントラクトで保全
* **スキーマ進化**：新評価指標（例：機械生成相場信頼スコア2.0）を後方互換で追加

---

## 14. イベント & 分析

* 主要イベント：`LoanOpened`, `Repaid`, `Defaulted`, `Liquidated`, `BadgeMinted`, `ValuationPosted`, `DeployedToAave`
* サブグラフ（The Graph）でダッシュボード提供：

  * TVL、借入総額、清算率、平均HF、平均LTV、平均Confidence、バッジ配布枚数

---

## 15. 失敗シナリオとフェイルセーフ

* **オラクル停止**：最後の有効価格に対し LTV 自動縮小、借入停止、返済のみ許可
* **市場急変**：Circuit Breaker で新規貸出停止・清算閾値緩和（短時間）
* **Aaveリスク**：Aave側障害時はプール手元流動性で対応、引出しの優先順位制御

---

## 16. 参考パラメータ初期値（例）

| パラメータ              | BlueChip |  Mid |  New |
| ------------------ | -------: | ---: | ---: |
| baseLTV            |     0.40 | 0.30 | 0.20 |
| minConfidence      |     0.70 | 0.65 | 0.60 |
| maxVolatility      |     0.60 | 0.65 | 0.70 |
| refreshInterval    |       1h |   2h |   4h |
| liquidationPenalty |       6% |   8% |  10% |

---

## 17. API/フロント仕様（抜粋）

### 17.1 コントラクト呼出（フロント）

* **借入見積**：`getQuote(collection, tokenId, currency)`

  * 返値：`value, effectiveLTV, maxBorrow, rate, hf_at_origination`
* **借入実行**：`approve(ERC721) → vault.deposit → loan.openLoan`
* **返済**：`loan.repay(loanId, amount)`（Permit2 対応）
* **ダッシュボード**：HF、残債、次回返済日、バッジ一覧、割引率

### 17.2 オフチェーンREST（AI）

* `POST /valuation`：NFTメタデータ → 署名付き評価
* `GET /collections/:addr/health`：流動性・ボラ更新
* 帯域制御・認証：API key + allowlist、署名検証のユニットテストを付与

---

## 18. QA計画（Foundry例）

* **単体**：Vault ロック/アンロック、Loan 開閉、異常系（過大借入、二重清算）、Oracle 期限切れ
* **プロパティ**：

  * 返済後は `withdraw` 可能
  * `HF` が単調に改善する（返済によって）
  * 清算プロシージャで会計が閉じる（不整合ゼロ）
* **ファジング**：価格ショック、突発的流動性引出、オークション不成立
* **統合**：Aave へのデプロイ/引出、aToken 会計一致

---

## 19. ロードマップ

1. **MVP**：BlueChip 3コレクション、USDCのみ、手動オラクル＋AI簡易版、固定金利
2. **v1**：可変金利、Chainlink Functions 統合、Dutch Auction、SBT報酬
3. **v2**：マルチチェーン、Trait-Oriented Oracle、バックストップ AMM、動的割引ロジック強化
4. **v3**：信用履歴のクロスチェーン SBT、二次流通の与信反映、オンチェーン機械学習の一部導入

---

## 20. リスク開示（ユーザー向け）

* NFT価格は急変しやすく、清算により資産を失う可能性
* オラクル障害・ブリッジ障害・マーケット断裂時の約定不成立
* Aave等、外部プロトコルの仕様変更・障害リスク
* 本DAppはスマートコントラクト・監査済みであっても残余リスクが存在

---

## 付録A：役割と権限

* **Admin/Guardian**：非常停止、オラクル切替
* **RiskCouncil**：コレクション上場/パラメータ調整
* **Auctioneer**：オークション執行（許可リスト）
* **Backstop**：清算バックストップ資金の供給者

---

## 付録B：主要イベント一覧

* `LoanOpened(loanId, borrower, collection, tokenId, amount)`
* `Repaid(loanId, amount, interestPaid)`
* `Defaulted(loanId)`
* `Liquidated(loanId, proceeds, liquidator)`
* `ValuationPosted(collection, tokenId, price, validUntil)`
* `BadgeMinted(user, badgeId, amount)`
* `DeployedToAave(asset, amount)` / `PulledFromAave(asset, amount)`

---

## 付録C：UX要点

* 借入前に **HF シミュレーション**と**清算価格の可視化**
* バッジ/割引が **見える化**（次回適用利率を事前に明示）
* 清算リスク時は **プッシュ通知**（Bot/Email/WebPush）
* 手数料内訳（オラクル・ガス・金利）を透明化

---

この仕様で、Aaveコアを変更せずに **NFT担保 × AI評価 × 返済ゲーミフィケーション** を提供できます。必要なら **Solidity スケルトン**や **Foundry テスト雛形**も出します。

