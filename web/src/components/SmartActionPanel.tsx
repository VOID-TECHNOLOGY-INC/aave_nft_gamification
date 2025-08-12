import { useMemo } from 'react'
import { decideCta, UiState } from '@/lib/cta'

export default function SmartActionPanel({ state, onClick }: { state: UiState; onClick?: () => void }) {
  const decision = useMemo(() => decideCta(state), [state])
  return (
    <div className="card">
      <h3>アクション</h3>
      {decision.reason && (
        <p style={{ color: '#f59e0b', marginBottom: 8 }}>理由: {decision.reason}</p>
      )}
      <button className="primary" disabled={decision.disabled} onClick={onClick}>
        {decision.label}
      </button>
    </div>
  )
}


