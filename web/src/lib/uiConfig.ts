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

export type UiGuardConfig = typeof UI_GUARDS

export function withOverrides(env: Record<string, string | undefined>, base: UiGuardConfig = UI_GUARDS): UiGuardConfig {
  // 例: VITE_UI_CONFIDENCE_WARN=0.62 といった環境変数で上書き可能
  const parseNum = (v?: string) => (v ? Number(v) : undefined)
  const cw = parseNum(env.VITE_UI_CONFIDENCE_WARN)
  const cb = parseNum(env.VITE_UI_CONFIDENCE_BLOCK)
  const lw = parseNum(env.VITE_UI_LIQUIDITY_WARN)
  const lb = parseNum(env.VITE_UI_LIQUIDITY_BLOCK)
  const vw = parseNum(env.VITE_UI_VOLATILITY_WARN)
  const vb = parseNum(env.VITE_UI_VOLATILITY_BLOCK)
  const ttl = parseNum(env.VITE_UI_EVAL_TTL_SEC)
  const soft = parseNum(env.VITE_UI_EVAL_REFRESH_SOFT_SEC)
  const sf = parseNum(env.VITE_UI_SAFETY_FACTOR)
  const hf = parseNum(env.VITE_UI_MIN_POST_HF)

  return {
    evaluationTtlSec: ttl ?? base.evaluationTtlSec,
    evaluationRefreshSoftSec: soft ?? base.evaluationRefreshSoftSec,
    thresholds: {
      confidence: { warn: cw ?? base.thresholds.confidence.warn, block: cb ?? base.thresholds.confidence.block },
      liquidity: { warn: lw ?? base.thresholds.liquidity.warn, block: lb ?? base.thresholds.liquidity.block },
      volatility: { warn: vw ?? base.thresholds.volatility.warn, block: vb ?? base.thresholds.volatility.block }
    },
    safetyFactor: sf ?? base.safetyFactor,
    minPostHf: hf ?? base.minPostHf
  } as const
}

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


