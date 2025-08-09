# NFT担保レンディング向け「複合モデル」評価アルゴリズム案

最終更新：2025-08-09（Asia/Tokyo）

---

## 0. 目的と設計方針

* **目的**：各NFTに対して「担保価値（Collateral Value）」と「信頼指標（Confidence）」を一貫した手順で算定し、**LTV・清算閾値**に直結させる。
* **方針**：

  1. **複数ソース**（フロア、取引履歴、属性、流動性、AI予測）を合成
  2. \*\*安全側（min/ヘアカット）\*\*での集約
  3. オンチェーンは**軽量**（合成・検証）、重い処理は**オフチェーン**で実施
  4. **署名・有効期限**・**回帰テスト**・**サーキットブレーカー**を内蔵

---

## 1. 入力データ（Off-chain収集）

| カテゴリ    | 記号       | 内容                    | 期間/粒度    |
| ------- | -------- | --------------------- | -------- |
| フロア価格   | `F`      | 主要市場の最安上場価格（TWAP）     | 1h/4h    |
| 個別履歴    | `S_self` | 対象NFT自身の過去成約（価格・時刻）   | 90日      |
| 近傍履歴    | `S_peer` | 近傍Trait/レア度の成約        | 90日      |
| 属性情報    | `T`      | 各Traitの希少度、希少度別プレミアム  | 静的＋定期再計算 |
| 流動性     | `L`      | 出来高、板厚、スプレッド、成約率      | 7d/30d   |
| ボラティリティ | `V`      | 標準偏差、最大ドローダウン、ジャンプリスク | 7d/30d   |
| 市況      | `M`      | コレクション指標（フロア変化率、出品比率） | 1h/24h   |
| 異常検知    | `W`      | ウォッシュトレード疑いスコア        | 90日      |
| AI予測    | `P_ai`   | 特徴量→公正価値の回帰/混合モデル     | 1h〜24h   |

> 取得元は複数マーケットAPIやデータレイク（Reservoir 等）を想定。重複・異常は事前クリーニング。

---

## 2. 個別コンポーネントのサブ評価

### 2.1 フロア基準値

* `F_TWAP = TWAP(F, window=4h)`
* フロアの信頼係数：`c_F = clamp( 1 - V_4h * k_F , 0.3, 1.0 )`

### 2.2 履歴基準値

* 自己履歴：加重平均 `H_self = WMA(S_self, decay=14d)` （なければ無視）
* 近傍履歴：分位点（p20〜p40）`H_peer = Quantile(WMA(S_peer), q=0.3)`
* 合成：`H = min*(H_self, H_peer)`（\*存在する方のみ。どちらも無ければスキップ）

### 2.3 属性補正（Trait Adjustment）

* トレイト毎プレミアム `Adj_trait = exp( z_score(trait_rarity) * k_T )` をクリップ `[0.8, 1.5]`
* `F_trait = F_TWAP * Adj_trait`
* 信頼 `c_T = clamp( base + n_trades_in_peer / thresh , 0.4, 0.9 )`

### 2.4 流動性調整

* 7日出来高 `vol7`, 板厚 `depth`, スプレッド `spr` から `L ∈ [0,1]`

  * 例：`L = w1*sigmoid(vol7) + w2*sigmoid(depth) + w3*(1 - sigmoid(spr))`
* ボラ `V ∈ [0,1]` を標準化（上位パーセンタイルで1近傍）
* 異常 `W ∈ [0,1]`（高いほど怪しい）

### 2.5 AI推定値

* 特徴量：`[F_TWAP, H, Adj_trait, L, V, M, 画像埋め込み, 時系列特徴]`
* 出力：`P_ai`（価格）, 付随スコア `c_ai_raw ∈ [0,1]`
* 異常補正：`c_ai = c_ai_raw * (1 - W)`（怪しさが高いほど減点）

---

## 3. 安全側への合成（最終価格と信頼）

### 3.1 価格候補

```
C1 = F_TWAP
C2 = F_trait
C3 = H               // 履歴基準
C4 = P_ai            // AI推定
```

### 3.2 候補ごとのヘアカット

* `hair(L,V,c_src) = h0 + hL*(1-L) + hV*V + hC*(1-c_src)` を `[h_min, h_max]` でクリップ

  * 推奨初期値：`h0=5%, hL=10%, hV=10%, hC=10%, h_min=5%, h_max=35%`

各候補の**安全価格**：

```
S1 = C1 * (1 - hair(L,V,c_F))
S2 = C2 * (1 - hair(L,V,c_T))
S3 = C3 * (1 - hair(L,V,c_H))   // c_Hは履歴データの充実度から算出
S4 = C4 * (1 - hair(L,V,c_ai))
```

### 3.3 サーキットブレーカー

* 直近`Δt`で `F_TWAP` が `-X%` 超の急落 → `S4`（AI）の寄与を抑制（例：重み半減）
* 出品比率急増、板薄化、スマートマネーフロー逆転などの**緊急フラグ**で **新規貸出停止** or `S*`にさらに`γ`減額

### 3.4 最終担保価値（安全側 min 合成）

```
CollateralValue = min( S1, S2, S3, S4 (※有効なもののみ) )
```

> ポリシーにより「min of (S1, S2) と S4 の min」など段階制も可。
> **常に安全側**を採用し、一時的な過大評価を抑制。

### 3.5 信頼スコア（Confidence）

```
c_set = {
  c_F,         // フロア由来
  c_T,         // 属性由来
  c_H,         // 履歴由来（データ数/新鮮度で定義）
  c_ai         // AI由来（汚染度補正済み）
}

Confidence = clamp( median(c_set_valid) - λ1*(1-L) - λ2*V - λ3*W , 0, 1 )
```

* 推奨初期値：`λ1=0.15, λ2=0.15, λ3=0.2`

---

## 4. LTV・清算指標への写像

### 4.1 有効LTV

* コレクション基準 `baseLTV ∈ [0.2, 0.4]`
* **信頼・流動性・ボラ**で調整：

```
adj = clamp( a1*Confidence + a2*L - a3*V , 0, 1 )
effectiveLTV = clamp( baseLTV * (0.7 + 0.3*adj), LTV_min, LTV_max )
```

* 推奨：`a1=0.6, a2=0.3, a3=0.4`, `LTV_min=0.15, LTV_max=0.45`

### 4.2 健全性（HF）と清算閾値

```
Debt = principal + accruedInterest
HF   = (CollateralValue * effectiveLTV) / Debt
清算トリガー: HF < 1.0 もしくは 期日超過
```

---

## 5. オラクル出力（オンチェーン反映仕様）

### 5.1 署名ペイロード（EIP-712）

```json
{
  "collection": "<address>",
  "tokenId": "<uint256>",
  "price1e8": "<uint256>",           // CollateralValue in USD 1e8
  "confidenceBP": "<0..10000>",
  "liquidityBP": "<0..10000>",
  "volatilityBP": "<0..10000>",
  "washBP": "<0..10000>",
  "validUntil": "<unix>",
  "nonce": "<uint64>",
  "circuitFlags": "<uint16>"         // bitmask
}
```

* 署名者はローテーション可能な`Signer`（マルチ・閾値署名対応）。
* `validUntil`経過・`nonce`再利用は**拒否**。
* オンチェーンでは**最終合成のみ**を保持し、元データはイベントで参照可能に。

### 5.2 オラクル合成（オンチェーン）

* 複数提供者（AI系、フロア系、バックアップ系）が同一NFTに値を投稿可能。
* 最終値は**min合成**＋**最大乖離チェック**（例：中央値から±30%超は無効）。
* 回答不足時：直近有効値を**時間劣化**（例：1h超過ごとに1～2%減額）して暫定適用。

---

## 6. ゲーミフィケーションとの連動

* `Confidence` と `L` が高いNFTで**期日通り返済** → SBTバッジ + 次回**オラクル料割引**
* 清算回避（HFをX日以上>1.2維持）→ 追加バッジ
* **悪用抑止**：短期借入・即返済の繰り返しはスコア寄与を逓減

---

## 7. 典型パラメータ（初期値）

| パラメータ            |                 値 | 備考           |
| ---------------- | ----------------: | ------------ |
| `k_F`            |               0.6 | フロア信頼のボラ補正   |
| `h0, hL, hV, hC` | 5%, 10%, 10%, 10% | ヘアカット基準      |
| `h_min, h_max`   |           5%, 35% | ヘアカット上下限     |
| `λ1, λ2, λ3`     |  0.15, 0.15, 0.20 | Confidence減算 |
| `a1, a2, a3`     |     0.6, 0.3, 0.4 | LTV調整重み      |
| `LTV_min, max`   |        0.15, 0.45 | ガード          |

---

## 8. 疑似コード

### 8.1 オフチェーン評価

```python
def evaluate_nft(inputs):
    F_TWAP = twap(inputs.floor_prices, 4*60)  # minutes
    c_F = clamp(1 - inputs.vol_4h * k_F, 0.3, 1.0)

    H_self = wma(inputs.sales_self, decay_days=14) if inputs.sales_self else None
    H_peer = quantile(wma(inputs.sales_peer), 0.3) if inputs.sales_peer else None
    H = merge_history(H_self, H_peer)  # min of available or None

    Adj_trait = clamp(exp(zscore(inputs.trait_rarity) * k_T), 0.8, 1.5)
    F_trait = F_TWAP * Adj_trait
    c_T = clamp(base + inputs.peer_trade_count/thresh, 0.4, 0.9)

    L = liquidity_score(inputs.vol7, inputs.depth, inputs.spread)
    V = volatility_score(inputs.ret_series)
    W = wash_score(inputs.tx_graph)

    P_ai, c_ai_raw = ai_predict(inputs.features)
    c_ai = c_ai_raw * (1 - W)

    candidates = [(F_TWAP, c_F), (F_trait, c_T)]
    if H:  candidates.append((H, c_H(H)))
    if P_ai: candidates.append((P_ai, c_ai))

    S = []
    for price, c_src in candidates:
        cut = haircut(L, V, c_src)     # bounded
        S.append(price * (1 - cut))

    if is_circuit_breaking(inputs):
        S = attenuate_ai(S)

    collateral_value = min(S)
    confidence = clamp(median([c for _, c in candidates]) - λ1*(1-L) - λ2*V - λ3*W, 0, 1)

    return collateral_value, confidence, L, V, W, circuit_flags
```

### 8.2 オンチェーン（Solidity擬似）

```solidity
function getCollateralValue(addr, id) external view returns (uint price1e8, uint16 confBP) {
    Val[] memory vals = postedVals[addr][id]; // 複数ソース
    Val memory v = combineMinWithOutlierReject(vals); // 例: 中央値±30%外は除外→min
    uint decayed = applyTimeDecay(v.price1e8, v.validUntil);
    return (decayed, v.confidenceBP);
}
```

---

## 9. 回帰テスト & モニタリング

* **テストセット**：上位20コレクション×各200トークン＝4,000サンプル
* **KPI**：

  * 清算時の回収率（`auctionProceeds / Debt`）中央値・p10
  * スリッページ（`CollateralValue / realizedSalePrice`）の分布
  * 誤検知率（無用な貸出停止）
* **データドリフト**：`c_ai_raw` の分布変化、`W`の上昇はアラート
* **ABテスト**：AI比重を抑えたルール vs 強めたルールで清算KPI比較

---

## 10. 運用ガード

* **Fail-closed**：有効評価が無い／期限切れ→新規貸出不可・返済のみ可
* **Decay**：オラクル未更新が続くほど担保価値を逓減（例：1h毎に1%）
* **緊急停止**：`circuitFlags`で新規貸出・LTV緩和・清算猶予を段階制適用

---

## 11. 参考：ミニ数値例

* `F_TWAP=10.0 ETH`, `Adj_trait=1.10` → `F_trait=11.0`
* `H=10.5`, `P_ai=11.3`
* `L=0.55`, `V=0.35`, `W=0.1`
* ヘアカット（概算）：`C1→-18%`, `C2→-15%`, `C3→-16%`, `C4→-17%`
* `S1=8.2`, `S2=9.35`, `S3=8.82`, `S4=9.38` → **min = 8.2**
* `Confidence ≈ 0.66` → `effectiveLTV ≈ baseLTV 0.35 × (0.7+0.3*adj) ≈ 0.31`
* USD換算・`HF`計算はプール通貨の価格オラクルで。

---

これで、**フロア×履歴×属性×流動性×AI**を安全側で合成し、**LTV・清算**に直結する実装準備が整います。
必要なら、このアルゴリズムに合わせた **Foundryテスト雛形**と **オラクルのEIP-712スキーマ実装**も続けて出します。

