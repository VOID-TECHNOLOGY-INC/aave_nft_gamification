# NFT担保レンディング向け「複合モデル」評価アルゴリズム案

最終更新：2025-08-12（Asia/Tokyo）

---

## 0. 目的と設計方針

- 目的：各NFTに対して「担保価値（Collateral Value）」と「信頼指標（Confidence）」を一貫した手順で算定し、LTV・清算閾値に直結させる。
- 方針：
  1. 複数ソース（フロア、取引履歴、属性、流動性、AI予測）を合成
  2. 常に安全側（min/ヘアカット）での集約
  3. オンチェーンは軽量（合成・検証）、重い処理はオフチェーン
  4. 署名・有効期限・回帰テスト・サーキットブレーカーを内蔵

---

## A. MVP 実装範囲（本リポで先行対応）

- 対応するデータコンポーネント
  - フロア価格 TWAP（主要市場集約、4h）
  - 近傍履歴（Trait/レア度近傍の成約、p30 分位）
  - 簡易 流動性 L（7d 出来高・板厚・スプレッドから 0..1 正規化）
  - ボラティリティ V（30d 標準化 0..1）
  - ウォッシュ疑義 W（0..1）
- 先送り（将来対応）
  - 画像/AI予測（P_ai）、自己履歴が極端に乏しい場合の補完強化
- 出力（Functions: `POST /api/evaluate`）
  - `collateralValueUSD_1e8`: USD建て担保価値（1e8）
  - `confidenceBP`, `L_bp`, `V_bp`, `W_bp`, `validUntil`, `circuitFlags`
  - 将来: `typedData`, `signature`（EIP-712）

---

## 1. 入力データ（Off-chain収集）

| カテゴリ    | 記号       | 内容                                  | 期間/粒度 |
| ----------- | ---------- | ------------------------------------- | -------- |
| フロア価格   | `F`        | 主要市場の最安上場価格（TWAP）            | 1h/4h    |
| 近傍履歴    | `S_peer`   | 近傍Trait/レア度の成約                    | 90日     |
| 流動性      | `L`        | 出来高、板厚、スプレッド、成約率            | 7d/30d   |
| ボラ        | `V`        | 標準偏差、最大ドローダウン、ジャンプリスク   | 7d/30d   |
| 市況        | `M`        | コレクション指標（フロア変化率、出品比率）   | 1h/24h   |
| 異常検知     | `W`        | ウォッシュトレード疑いスコア               | 90日     |
| （将来）AI  | `P_ai`     | 特徴量→公正価値の回帰/混合モデル            | 1h〜24h  |

> データ取得は Reservoir, OpenSea, Blur 等の複数マーケットAPIを冗長化して実施する。各ソースのヘルスとレイテンシを監視し、下記のルールで集約する。
>
> - ソース健全性スコア `s_src ∈ [0,1]` を付与（稼働率、タイムアウト率、レイテンシ、直近エラー率で算出）。
> - 集約値は加重中央値（weights=`s_src`）→残差に対し `MAD`/`IQR` を用いたロバスト外れ値除去（|z|>3 を棄却）。
> - レートリミット/失敗時は指数バックオフ＋フェイルオーバー。TTL を設定（例：フロア価格 5 分、出来高 30 分）。
> - 主要ソースが閾値未満（例：有効ソース数 < 2 or 合計重み < 1.2）の場合は `degraded` としてフラグを付与し、Confidence にペナルティを適用。

---

## 2. コンポーネント算出（MVP仕様）

### 2.1 フロア基準値
- `F_TWAP = TWAP(F, window=4h)`
- 信頼係数：`c_F = clamp( 1 - V_4h * k_F , 0.3, 1.0 )`

### 2.2 近傍履歴
- 近傍分位点 `H_peer = Quantile(WMA(S_peer), q=0.3)`（近傍重み付き）
- 信頼 `c_H` はデータ件数・新鮮度で 0.4..0.9 に正規化
> 近傍定義（明確化）
>
> - 各トークン `i` の属性ベクトル `x_i`（標準化した trait rarity、カテゴリ埋め込み、supply 正規化等）を構築。
> - 距離 `d(i,j) = || W (x_i - x_j) ||_2`（対角重み行列 `W` は学習/キャリブレーションで決定）。
> - `K` 近傍（推奨初期値 `K=50`）を抽出し、取引金額に対し時間減衰重み `w_t = exp(-Δt/τ)`（推奨 `τ=14d`）を付与した加重系列を用いる。
> - サンプル最小要件：有効取引 `N_eff = Σ w_t ≥ N_min`（推奨 `N_min=5`）。満たさない場合は `H_peer` を無効化して `F_TWAP` のみを候補とする。
> - 妥当性はバックテストで継続評価し、`W` の更新はセマンティックバージョンに追随（下記 "パラメータとバージョニング" 参照）。

### 2.3 属性補正（任意・MVPではオフ）
- `Adj_trait = exp( zscore(trait_rarity) * k_T )` を `[0.8, 1.5]` にクリップ
- `F_trait = F_TWAP * Adj_trait`
- `c_T` は近傍トレード充足度から算出
- 注: MVP では `Adj_trait` は 1.0 固定（将来拡張）

### 2.4 流動性・ボラ・異常
- `L ∈ [0,1]`（vol7、depth、spr からシグモイド合成）
- `V ∈ [0,1]`（30d 標準化）
- `W ∈ [0,1]`（高いほど怪しい）

---

## 3. 安全側合成（最終価格と信頼）

### 3.1 価格候補（MVP）
```
C1 = F_TWAP
C2 = H_peer        // 履歴基準
（将来）C3 = F_trait
（将来）C4 = P_ai
```

### 3.2 候補ごとのヘアカット
- `hair(L,V,c_src) = h0 + hL*(1-L) + hV*V + hC*(1-c_src)` を `[h_min, h_max]` でクリップ
- 推奨初期値：`h0=5%, hL=10%, hV=10%, hC=10%, h_min=5%, h_max=35%`

安全価格：
```
S1 = C1 * (1 - hair(L,V,c_F))
S2 = C2 * (1 - hair(L,V,c_H))
（将来）S3 = C3 * (1 - hair(L,V,c_T))
（将来）S4 = C4 * (1 - hair(L,V,c_ai))
```

### 3.3 サーキットブレーカー
- 直近 `Δt` で `F_TWAP` が `-X%` 超の急落 → AI/履歴の寄与抑制（MVPはフラグ通知のみ）
- 出品比率急増・板薄化・スマートマネーフロー逆転 → `circuitFlags` セット（UI/借入ガードに反映）
- 主要価格ソース乖離の定式化：
  - 乖離率 `div = |F_TWAP - H_peer| / max(F_TWAP, H_peer)`（`H_peer` 不在時は `div=0`）。
  - 閾値 `Y` を超える部分に対しペナルティ `pen_div = k_div * max(0, div - Y)` を適用（`k_div` は 0..1 にマッピングされる係数）。
  - `div > Y_crit` の場合は `circuitFlags.DIVERGENCE` をセットし、新規借入を段階的に制限。
  - 推奨初期値：`Y=0.15`、`Y_crit=0.35`、`k_div=0.8`。
> 手動緊急停止（Runbook 概要）
> - 条件：市場急変/データ障害/署名鍵インシデント。
> - 手順：ガバナンス承認済みの `guardian` により `circuitFlags.EMERGENCY_STOP` をオン→ API は `effectiveLTV=0` を返却（返済のみ許可）。
> - 解除：事後レビュー（Postmortem）と再発防止策の提示後、二重承認で解除。

### 3.4 最終担保価値（min 合成）
```
CollateralValue = min( 有効な S* )
```

### 3.5 信頼スコア（Confidence）
```
c_set = { c_F, c_H }   // MVP
Confidence = clamp(
  median(c_set)
  - λ1*(1-L)
  - λ2*V
  - λ3*W
  - λ4*max(0, div - Y)    # 主要ソース乖離ペナルティ（3.3）
  - λ5*degraded_flag       # データ取得の劣化（1=劣化, 0=正常）
, 0, 1)
```
- 推奨初期値：`λ1=0.15, λ2=0.15, λ3=0.20, λ4=0.50, λ5=0.10`

### 3.6 パラメータ設計と根拠（暫定）

本アルゴリズムに含まれる各種係数（`h*`, `λ*`, `a*`等）は、プロトコルのリスク許容度を決定する重要な要素である。
- **初期値設定:** 提示されている初期値は、一般的な市況を想定し、安全側に倒した保守的な値である。
- **バックテスト:** 過去の市場データ（特に高変動期）を用いた広範なバックテストを実施し、清算イベントにおける回収率やスリッページをシミュレーションすることで、パラメータの妥当性を検証する。
- **感度分析:** 各パラメータが最終的な担保価値やLTVに与える影響を分析し、特定のリスクファクターに対するシステムの頑健性を評価する。
- **継続的な調整:** これらのパラメータは固定ではなく、市場環境の変化や実運用データに基づき、ガバナンスを通じて定期的に見直し・調整される。

---

## 4. LTV・HF への写像

### 4.1 有効LTV
- コレクション基準 `baseLTV ∈ [0.2, 0.4]`
```
adj = clamp( a1*Confidence + a2*L - a3*V , 0, 1 )
effectiveLTV = clamp( baseLTV * (0.7 + 0.3*adj), LTV_min, LTV_max )
```
- 推奨：`a1=0.6, a2=0.3, a3=0.4`, `LTV_min=0.15, LTV_max=0.45`

### 4.2 健全性（HF）
```
Debt = principal + accruedInterest
HF   = (CollateralValue * effectiveLTV) / Debt
清算トリガー: HF < 1.0 もしくは 期日超過
```

---

## 5. オラクル出力（オンチェーン/オフチェーン仕様）

### 5.1 HTTP 応答（MVP）

```json
{
  "collection": "<address>",
  "tokenId": "<string>",
  "version": "<semver>",
  "modelHash": "<sha256>",
  "evaluationId": "<uuid>",
  "collateralValueUSD_1e8": "<uint64>",
  "confidenceBP": "<0..10000>",
  "validUntil": "<unix>",
  "nonce": "<uint64>",
  "circuitFlags": "<uint16>",
  "sourceStatus": {
    "reservoir": "<ok|degraded|down>",
    "opensea": "<ok|degraded|down>",
    "blur": "<ok|degraded|down>"
  },
  "dataFreshnessSec": {
    "floor": "<uint32>",
    "sales": "<uint32>",
    "liquidity": "<uint32>"
  },
  "debugInfo": {
    "F_TWAP_1e8": "<uint64>",
    "H_peer_1e8": "<uint64>",
    "divergenceBP": "<0..10000>",
    "haircutBP": "<0..10000>",
    "L_bp": "<0..10000>",
    "V_bp": "<0..10000>",
    "W_bp": "<0..10000>",
    "penalty_div_bp": "<0..10000>",
    "candidates": [
      { "name": "F_TWAP", "price_1e8": "<uint64>", "c_src_bp": "<0..10000>", "cut_bp": "<0..10000>", "safe_1e8": "<uint64>" },
      { "name": "H_peer", "price_1e8": "<uint64>", "c_src_bp": "<0..10000>", "cut_bp": "<0..10000>", "safe_1e8": "<uint64>" }
    ]
  }
}
```

- `validUntil` 経過・`nonce` 再利用は拒否（Fail-closed）
- 未更新が続く場合、UI では逓減を注記（MVP は数値に逓減を反映しない）

### 5.2 署名ペイロード（EIP-712、将来）

```json
{
  "collection": "<address>",
  "tokenId": "<uint256>",
  "version": "<semver>",
  "modelHash": "<sha256>",
  "collateralValueUSD_1e8": "<uint256>",
  "confidenceBP": "<0..10000>",
  "liquidityBP": "<0..10000>",
  "volatilityBP": "<0..10000>",
  "washBP": "<0..10000>",
  "validUntil": "<unix>",
  "nonce": "<uint64>",
  "circuitFlags": "<uint16>"
}
```

- 署名者はローテーション可能な `Signer`（マルチ/閾値署名可）
- **署名鍵管理:** 署名鍵はハードウェア・セキュリティ・モジュール（HSM）または同等のセキュアな環境で厳格に管理される。鍵の生成、保管、ローテーション、緊急失効に関する運用ポリシーを定め、遵守する。
- 将来はオンチェーンで min 合成＋最大乖離チェックを実装

---

## 6. 擬似コード（MVP）

### 6.1 オフチェーン評価

```python
def evaluate_nft(inputs):
    F_TWAP = twap(inputs.floor_prices, 4*60)  # minutes
    c_F = clamp(1 - inputs.vol_4h * k_F, 0.3, 1.0)

    H_peer = quantile(wma(inputs.sales_peer), 0.3) if inputs.sales_peer else None
    c_H = confidence_from_hist(inputs.sales_peer)

    L = liquidity_score(inputs.vol7, inputs.depth, inputs.spread)   # 0..1
    V = volatility_score(inputs.ret_series)                         # 0..1
    W = wash_score(inputs.tx_graph)                                 # 0..1

    candidates = [(F_TWAP, c_F)]
    if H_peer:  candidates.append((H_peer, c_H))

    S = []
    for price, c_src in candidates:
        cut = haircut(L, V, c_src)  # bounded
        S.append(price * (1 - cut))

    # 主要ソース乖離の計算
    div = 0.0 if not H_peer else abs(F_TWAP - H_peer) / max(F_TWAP, H_peer)
    penalty_div = k_div * max(0, div - Y)

    circuit = detect_circuit_break(inputs, div=div)  # 急落/板薄/出品比率急増/乖離等

    collateral_value = min(S)
    confidence = clamp(
        median([c for _, c in candidates])
        - λ1*(1-L) - λ2*V - λ3*W - λ4*max(0, div - Y) - λ5*inputs.degraded_flag,
        0, 1
    )

    debug = {
        "F_TWAP": F_TWAP,
        "H_peer": H_peer,
        "divergence": div,
        "penalty_div": penalty_div,
        "L": L, "V": V, "W": W,
        "candidates": candidates,
    }

    return collateral_value, confidence, L, V, W, circuit, debug
```

### 6.2 UI 反映（例）

- `Borrow`/`OpenLoan` で `evaluate` を呼び出す
- Confidence/L が低い場合は LTV を保守側に丸め、送信ボタンを無効化
- `circuitFlags` が立っている場合、新規借入を停止（表示で明示）

---

## 7. 回帰テスト & モニタリング

- テストセット：上位コレクション×サンプルでの評価スナップショット（四半期ごと更新）
- KPI：
  - 清算時の回収率（`auctionProceeds / Debt`）中央値・p10
  - スリッページ（`CollateralValue / realizedSalePrice`）の分布（左裾リスク）
  - 回答率（`validUntil` 内に評価取得できた割合）
- データドリフト：`L/V/W` と `div` の分布変化を監視（PSI, KS 検定）
- キャリブレーション：時系列クロスバリデーションで `h*`, `λ*`, `a*`, `K`, `τ`, `Y`, `k_div` を最適化（目的：清算損失最小/貸出可能額最大のトレードオフ）。
- AB テスト：係数変更の前後で清算 KPI を比較し、統計的有意性を確認。

---

## 8. 運用ガード

### 8.1 オフチェーンインフラの信頼性
- **冗長化:** 評価エンジンとデータ収集コンポーネントは複数の物理的・地理的に分散したサーバーで冗長化され、単一障害点を排除する。
- **アクセス制御:** 本番環境へのアクセスは厳格に制限され、全ての操作は監査ログとして記録される。
- **継続的な監査:** システムは定期的に第三者のセキュリティ監査を受ける。
 - **DR/BCP:** 目標 RTO 15 分、RPO 5 分。日次バックアップ＋四半期ごとの DR テストを実施。

### 8.2 モデルの陳腐化への対応
- **定期レビュー:** 市場のトレンド変化に対応するため、評価モデルとパラメータは四半期ごとにパフォーマンスをレビューする。
- **ガバナンス:** モデルやパラメータの重要な変更は、ガバナンスプロセス（コミュニティ投票など）を経て決定される。
 - **バージョニング:** アルゴリズムと係数は `version`（SemVer）と `modelHash`（構成ハッシュ）でトラッキングし、互換性のない変更はメジャー更新として周知する。

### 8.3 運用ルール
- Fail-closed：有効評価が無い/期限切れ → 新規借入不可・返済のみ
- Decay（将来）：未更新が続くほど担保価値を逓減
- 緊急停止：`circuitFlags` で新規貸出・LTV を段階制限

### 8.4 署名鍵とセキュリティ運用
- **鍵保護:** HSM もしくは同等のセキュアエンクレーブで鍵を管理。署名操作は隔離環境で実行。
- **ローテーション:** `Signer` は閾値マルチシグ（例：3/5）を推奨。四半期ごとに鍵をローテーション、インシデント時は即時失効。
- **監査証跡:** 署名リクエスト/レスポンス、承認フロー、失敗ログを完全保存（WORM ストレージ）。

---

## 9. パラメータとバージョニング

- パラメータ（初期値）：
  - `h0=5%`, `hL=10%`, `hV=10%`, `hC=10%`, `h_min=5%`, `h_max=35%`
  - `λ1=0.15`, `λ2=0.15`, `λ3=0.20`, `λ4=0.50`, `λ5=0.10`
  - `K=50`, `τ=14d`, `N_min=5`, `Y=0.15`, `Y_crit=0.35`, `k_div=0.8`
- バージョニング方針：SemVer（例：`1.2.0`）。マイナー更新は係数微調整、パッチ更新はバグ修正。互換性のない変更（特徴量セット/距離関数の変更等）はメジャー更新。
- 変更管理：`version`/`modelHash` を API 応答と署名ペイロードに含め、クライアントは互換性を検証。


