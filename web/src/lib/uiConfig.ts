// UI ガードやしきい値の設定（doc/frontend.md 準拠）
export const UI_GUARDS = {
  evaluationTtlSec: 300, // 5分
  evaluationRefreshSoftSec: 180, // 3分で再取得
  thresholds: {
    confidence: { warn: 0.6, block: 0.55 },
    liquidity: { warn: 0.5, block: 0.4 },
    volatility: { warn: 0.6, block: 0.7 }
  },
  safetyFactor: 0.95, // maxBorrowの95%まで
  minPostHf: 1.2
} as const

export type EvaluateSnapshot = {
  valueUsd?: number
  effectiveLtv?: number
  maxBorrowUsd?: number
  healthFactor?: number
  confidence?: number
  liquidity?: number
  volatility?: number
  circuitFlags?: string[]
  fetchedAt?: number // epoch seconds
}


