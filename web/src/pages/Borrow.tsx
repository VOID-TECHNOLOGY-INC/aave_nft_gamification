import { useMemo, useState } from 'react'
import { getQuoteUSD } from '@/lib/loanMath'
import { useAccount } from 'wagmi'
import { useAavePool } from '@/hooks/useAavePool'
import { fetchQuoteSim } from '@/services/quote'
import { Stepper } from '@/components/Stepper'
import Approve721 from '@/components/Approve721'
import DepositVault from '@/components/DepositVault'
import OpenLoan from '@/components/OpenLoan'

export default function Borrow() {
  const [price1e8, setPrice1e8] = useState<number>(100_00_0000) // $100 default
  const [baseLTV, setBaseLTV] = useState<number>(0.35)
  const [confidence, setConfidence] = useState<number>(0.7)
  const [liquidity, setLiquidity] = useState<number>(0.6)
  const [volatility, setVolatility] = useState<number>(0.3)
  const [debt, setDebt] = useState<number>(0)

  const { isConnected } = useAccount()
  const { ready } = useAavePool()

  const quote = useMemo(() => {
    return getQuoteUSD({ price1e8, baseLTV, confidence, liquidity, volatility, debt })
  }, [price1e8, baseLTV, confidence, liquidity, volatility, debt])

  const [remote, setRemote] = useState<null | { valueUsd: number; effectiveLTV: number; maxBorrowUsd: number; healthFactor: number }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canBorrow = isConnected && ready

  async function loadRemote() {
    setLoading(true)
    setError(null)
    setRemote(null)
    try {
      const valueUsd = price1e8 / 1e8
      const res = await fetchQuoteSim({ priceUsd: valueUsd, baseLTV, confidence, liquidity, volatility, debt })
      setRemote(res)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  // Dummy flow state
  const [activeStep, setActiveStep] = useState(0)
  const steps = [
    { title: '承認(Approve ERC-721)' },
    { title: 'Vaultに預入(Deposit)' },
    { title: 'Loan Open(借入実行)' }
  ]

  return (
    <section>
      <h2>借入見積</h2>
      <div className="grid">
        <label>
          価格(USD 1e8)
          <input type="number" value={price1e8} onChange={(e) => setPrice1e8(Number(e.target.value))} />
        </label>
        <label>
          baseLTV (0-1)
          <input type="number" step="0.01" value={baseLTV} onChange={(e) => setBaseLTV(Number(e.target.value))} />
        </label>
        <label>
          confidence (0-1)
          <input type="number" step="0.01" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
        </label>
        <label>
          liquidity (0-1)
          <input type="number" step="0.01" value={liquidity} onChange={(e) => setLiquidity(Number(e.target.value))} />
        </label>
        <label>
          volatility (0-1)
          <input type="number" step="0.01" value={volatility} onChange={(e) => setVolatility(Number(e.target.value))} />
        </label>
        <label>
          借入希望額(USD)
          <input type="number" step="0.01" value={debt} onChange={(e) => setDebt(Number(e.target.value))} />
        </label>
      </div>

      <div className="card">
        <h3>ローカル計算</h3>
        <ul>
          <li>有効LTV: {quote.effectiveLTV.toFixed(3)}</li>
          <li>最大借入(USD): {quote.maxBorrowUsd.toFixed(2)}</li>
          <li>健全性HF: {quote.healthFactor.toFixed(3)}</li>
          <li>担保評価額(USD): {quote.valueUsd.toFixed(2)}</li>
        </ul>
      </div>

      <div className="card">
        <h3>クラウド計算（Functions）</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="primary" onClick={loadRemote} disabled={loading}>
            {loading ? '取得中...' : 'quoteSimを取得'}
          </button>
          {error && <span style={{ color: '#f87171' }}>{error}</span>}
        </div>
        {remote && (
          <ul>
            <li>有効LTV: {remote.effectiveLTV.toFixed(3)}</li>
            <li>最大借入(USD): {remote.maxBorrowUsd.toFixed(2)}</li>
            <li>健全性HF: {remote.healthFactor.toFixed(3)}</li>
            <li>担保評価額(USD): {remote.valueUsd.toFixed(2)}</li>
          </ul>
        )}
      </div>

      <div className="card">
        <h3>借入フロー</h3>
        <Stepper steps={steps} active={activeStep} />
        {activeStep === 0 && <Approve721 />}
        {activeStep === 1 && <DepositVault />}
        {activeStep === 2 && <OpenLoan />}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="primary" onClick={() => setActiveStep((s) => Math.max(0, s - 1))} disabled={activeStep === 0}>
            戻る
          </button>
          <button className="primary" onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))} disabled={!canBorrow || activeStep === steps.length - 1}>
            次へ
          </button>
        </div>
        {!canBorrow && <p style={{ color: '#9aa0a6' }}>ウォレット接続とAave Pool設定が必要です。</p>}
      </div>
    </section>
  )
}
