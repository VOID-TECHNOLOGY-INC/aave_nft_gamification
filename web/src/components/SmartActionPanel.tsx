import { useMemo } from 'react'
import { decideCta, UiState } from '@/lib/cta'
import { GasEstimateResult } from '@/lib/gas'

export default function SmartActionPanel({ state, onClick, gas }: { state: UiState; onClick?: () => void; gas?: GasEstimateResult }) {
  const decision = useMemo(() => decideCta(state), [state])
  return (
    <div className="card">
      <h3>アクション</h3>
      {decision.reason && (
        <p style={{ color: '#f59e0b', marginBottom: 8 }}>理由: {decision.reason}</p>
      )}
      {gas && gas.ok && (
        <p style={{ color: '#9aa0a6', margin: 0 }}>推定手数料: ${gas.usd.toFixed(3)}</p>
      )}
      {gas && !gas.ok && (
        <p style={{ color: '#f87171', margin: 0 }}>ガス見積失敗: {gas.message}</p>
      )}
      <button className="primary" disabled={decision.disabled} onClick={onClick}>
        {decision.label}
      </button>
    </div>
  )
}


