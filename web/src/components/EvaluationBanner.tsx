import { formatRelativeTime } from '@/lib/time'

type Props = {
  valueUsd?: number
  effectiveLtv?: number
  maxBorrowUsd?: number
  healthFactor?: number
  confidence?: number
  liquidity?: number
  volatility?: number
  circuitFlags?: string[]
  fetchedAt?: number
}

export default function EvaluationBanner(p: Props) {
  const fresh = formatRelativeTime(p.fetchedAt)
  const danger = (p.circuitFlags && p.circuitFlags.length > 0) || (p.confidence !== undefined && p.confidence < 0.55)
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>最大借入(USD)</div>
          <div style={{ fontSize: 28 }}>{p.maxBorrowUsd?.toFixed(2) ?? '—'}</div>
          <div style={{ color: '#9aa0a6' }}>HF: {p.healthFactor?.toFixed(2) ?? '—'} / LTV: {p.effectiveLtv?.toFixed(3) ?? '—'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {danger && <div style={{ color: '#f87171', fontWeight: 600 }}>警告: 市況/信頼性により制限中</div>}
          <div style={{ color: '#9aa0a6' }}>評価更新: {fresh}</div>
        </div>
      </div>
    </div>
  )
}


