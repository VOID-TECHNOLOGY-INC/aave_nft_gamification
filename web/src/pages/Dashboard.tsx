import { useAccount } from 'wagmi'
import { useAavePool } from '@/hooks/useAavePool'
import { useEffect, useState } from 'react'
import AaveReserveInfo from '@/components/AaveReserveInfo'

export default function Dashboard() {
  const { address, isConnected } = useAccount()
  const { pool, ready } = useAavePool()
  const [userData, setUserData] = useState<{
    totalCollateralBase: bigint
    totalDebtBase: bigint
    availableBorrowsBase: bigint
    currentLiquidationThreshold: number
    ltv: number
    healthFactor: bigint
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      setUserData(null)
      if (!isConnected || !ready || !pool || !address) return
      try {
        const res = await (pool.read as any).getUserAccountData([address])
        if (cancelled) return
        const [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor] = res as [bigint, bigint, bigint, bigint, bigint, bigint]
        setUserData({
          totalCollateralBase,
          totalDebtBase,
          availableBorrowsBase,
          currentLiquidationThreshold: Number(currentLiquidationThreshold),
          ltv: Number(ltv),
          healthFactor
        })
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e))
      }
    }
    load()
    return () => { cancelled = true }
  }, [isConnected, ready, pool, address])

  return (
    <section>
      <h2>ダッシュボード</h2>
      <div className="card">
        <div>ウォレット: {isConnected ? address : '未接続'}</div>
        <div>Aave Pool: {ready ? '接続OK' : '未設定（envにVITE_AAVE_POOL_ADDRESS_BASE_SEPOLIAが必要）'}</div>
      </div>

      {error && <p style={{ color: '#f87171' }}>読み取りエラー: {error}</p>}

      {userData ? (
        <div className="card">
          <h3>Aave ユーザーデータ</h3>
          <ul>
            <li>総担保(base): {userData.totalCollateralBase.toString()}</li>
            <li>総負債(base): {userData.totalDebtBase.toString()}</li>
            <li>借入可能(base): {userData.availableBorrowsBase.toString()}</li>
            <li>LiquidationThreshold(bp): {userData.currentLiquidationThreshold}</li>
            <li>LTV(bp): {userData.ltv}</li>
            <li>HealthFactor(1e18): {userData.healthFactor.toString()}</li>
          </ul>
        </div>
      ) : (
        <p style={{ color: '#9aa0a6' }}>接続済みかつPoolが設定されると、ユーザーデータを表示します。</p>
      )}

      <AaveReserveInfo />
    </section>
  )
}
