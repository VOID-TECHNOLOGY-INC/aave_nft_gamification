import { UI_GUARDS, EvaluateSnapshot } from './uiConfig'

export type UiState = {
  isConnected: boolean
  isApproved: boolean
  isDeposited: boolean
  amountUsd: number | undefined
  networkOk: boolean
  evalSnap?: EvaluateSnapshot
}

export type CtaDecision = {
  label: string
  disabled: boolean
  reason?: string
  nextStateHint?: 'connect' | 'approve' | 'deposit' | 'borrow' | 'done'
}

function isEvalExpired(s?: EvaluateSnapshot): boolean {
  if (!s?.fetchedAt) return true
  const now = Math.floor(Date.now() / 1000)
  return now - s.fetchedAt > UI_GUARDS.evaluationTtlSec
}

function guardsFail(s: UiState): string | undefined {
  const e = s.evalSnap
  if (!e || isEvalExpired(e)) return '評価が有効ではありません'
  if (e.circuitFlags && e.circuitFlags.length > 0) return '市場状況により一時停止中'
  if (typeof e.confidence === 'number' && e.confidence < UI_GUARDS.thresholds.confidence.block) return '信頼性が不足しています'
  if (typeof e.liquidity === 'number' && e.liquidity < UI_GUARDS.thresholds.liquidity.block) return '流動性が不足しています'
  if (typeof e.volatility === 'number' && e.volatility > UI_GUARDS.thresholds.volatility.block) return 'ボラティリティが高すぎます'
  if (typeof s.amountUsd === 'number' && typeof e.maxBorrowUsd === 'number') {
    const limit = e.maxBorrowUsd * UI_GUARDS.safetyFactor
    if (s.amountUsd > limit) return '希望額が上限を超えています'
  }
  if (typeof e.healthFactor === 'number' && e.healthFactor < UI_GUARDS.minPostHf) return '健全性(HF)が不足しています'
  return undefined
}

export function decideCta(s: UiState): CtaDecision {
  if (!s.networkOk) return { label: '対応ネットワークに切替', disabled: false, nextStateHint: 'connect' }
  if (!s.isConnected) return { label: 'ウォレット接続', disabled: false, nextStateHint: 'connect' }
  if (!s.isApproved) return { label: '承認を送信', disabled: false, nextStateHint: 'approve' }
  if (!s.isDeposited) return { label: '預入を送信', disabled: false, nextStateHint: 'deposit' }

  // 借入段階
  const reason = guardsFail(s)
  if (reason) return { label: '借入を送信', disabled: true, reason }
  return { label: '借入を送信', disabled: false, nextStateHint: 'borrow' }
}


