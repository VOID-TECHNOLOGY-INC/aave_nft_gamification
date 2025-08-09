import { useState } from 'react'
import { useAavePool } from '@/hooks/useAavePool'
import { Address } from 'viem'

function rayToPercent(rateRay: bigint): string {
  // Aave rates are in ray (1e27). Convert to APR percent
  const apr = Number(rateRay) / 1e27
  return (apr * 100).toFixed(2) + '%'
}

export default function AaveReserveInfo() {
  const { pool, ready } = useAavePool()
  const [asset, setAsset] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<null | {
    currentLiquidityRate: bigint
    currentVariableBorrowRate: bigint
    currentStableBorrowRate: bigint
    aTokenAddress: string
    stableDebtTokenAddress: string
    variableDebtTokenAddress: string
    interestRateStrategyAddress: string
  }>(null)

  async function load() {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      if (!ready || !pool) throw new Error('Pool not ready')
      if (!asset || !asset.startsWith('0x') || asset.length !== 42) throw new Error('資産アドレスを入力してください')
      const res = await (pool.read as any).getReserveData([asset as Address])
      // viem returns struct as object or array depending on ABI; normalize via indices
      const currentLiquidityRate = res.currentLiquidityRate ?? res[3]
      const currentVariableBorrowRate = res.currentVariableBorrowRate ?? res[4]
      const currentStableBorrowRate = res.currentStableBorrowRate ?? res[5]
      const aTokenAddress = (res.aTokenAddress ?? res[8]) as string
      const stableDebtTokenAddress = (res.stableDebtTokenAddress ?? res[9]) as string
      const variableDebtTokenAddress = (res.variableDebtTokenAddress ?? res[10]) as string
      const interestRateStrategyAddress = (res.interestRateStrategyAddress ?? res[11]) as string
      setData({
        currentLiquidityRate,
        currentVariableBorrowRate,
        currentStableBorrowRate,
        aTokenAddress,
        stableDebtTokenAddress,
        variableDebtTokenAddress,
        interestRateStrategyAddress
      })
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h3>Aave リザーブ金利</h3>
      <div className="grid" style={{ gridTemplateColumns: '1fr auto' }}>
        <label>
          資産アドレス (ERC20)
          <input placeholder="0x..." value={asset} onChange={(e) => setAsset(e.target.value.trim())} />
        </label>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button className="primary" onClick={load} disabled={!ready || loading}>
            {loading ? '読込中...' : '取得'}
          </button>
        </div>
      </div>
      {!ready && <p style={{ color: '#9aa0a6' }}>Pool未設定（環境変数でVITE_AAVE_POOL_ADDRESS_BASE_SEPOLIAを設定）</p>}
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {data && (
        <ul>
          <li>Supply APR: {rayToPercent(data.currentLiquidityRate)}</li>
          <li>Variable Borrow APR: {rayToPercent(data.currentVariableBorrowRate)}</li>
          <li>Stable Borrow APR: {rayToPercent(data.currentStableBorrowRate)}</li>
          <li>aToken: {data.aTokenAddress}</li>
          <li>stableDebtToken: {data.stableDebtTokenAddress}</li>
          <li>variableDebtToken: {data.variableDebtTokenAddress}</li>
          <li>rateStrategy: {data.interestRateStrategyAddress}</li>
        </ul>
      )}
    </div>
  )
}
