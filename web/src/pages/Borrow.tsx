import { useEffect, useMemo, useState } from 'react'
import { getQuoteUSD } from '@/lib/loanMath'
import { useAccount } from 'wagmi'
import { useAavePool } from '@/hooks/useAavePool'
import { fetchQuoteSim } from '@/services/quote'
import EvaluationBanner from '@/components/EvaluationBanner'
import SmartActionPanel from '@/components/SmartActionPanel'
import BorrowChecklist from '@/components/BorrowChecklist'
import { decideCta, UiState } from '@/lib/cta'
import { CONFIG } from '@/config'
import { Address, isAddress, parseUnits } from 'viem'
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'

export default function Borrow() {
  const [price1e8, setPrice1e8] = useState<number>(100_00_0000) // $100 default
  const [baseLTV, setBaseLTV] = useState<number>(0.35)
  const [confidence, setConfidence] = useState<number>(0.7)
  const [liquidity, setLiquidity] = useState<number>(0.6)
  const [volatility, setVolatility] = useState<number>(0.3)
  const [debt, setDebt] = useState<number>(0)

  const { isConnected } = useAccount()
  const { address: userAddress } = useAccount()
  const { ready } = useAavePool()

  const quote = useMemo(() => {
    return getQuoteUSD({ price1e8, baseLTV, confidence, liquidity, volatility, debt })
  }, [price1e8, baseLTV, confidence, liquidity, volatility, debt])

  const [remote, setRemote] = useState<null | { valueUsd: number; effectiveLTV: number; maxBorrowUsd: number; healthFactor: number }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 新UI用フォーム（アドレス類）
  const [collection, setCollection] = useState<string>('')
  const [tokenId, setTokenId] = useState<string>('')
  const [vault, setVault] = useState<string>(CONFIG.vaultAddress ?? '')
  const [loanManager, setLoanManager] = useState<string>(CONFIG.loanManagerAddress ?? '')
  const [currency, setCurrency] = useState<string>('')
  const [decimals, setDecimals] = useState<string>('6')

  // 進行要件: Step1/2 はウォレット接続のみ。Step3 以降でAave設定が必要になったら別途ガード。
  const canProceed = isConnected

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

  const uiState: UiState = {
    isConnected,
    isApproved: false,
    isDeposited: false,
    amountUsd: debt,
    networkOk: true,
    evalSnap: remote
      ? {
          valueUsd: remote.valueUsd,
          effectiveLtv: remote.effectiveLTV,
          maxBorrowUsd: remote.maxBorrowUsd,
          healthFactor: remote.healthFactor,
          fetchedAt: Math.floor(Date.now() / 1000)
        }
      : undefined
  }
  const decision = decideCta(uiState)

  // 承認状態読み取り（簡易）
  const ERC721_ABI = [{ type: 'function', name: 'getApproved', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] }] as const
  const { data: approvedTo } = useReadContract({
    abi: ERC721_ABI,
    address: isAddress(collection) ? (collection as Address) : undefined,
    functionName: 'getApproved',
    args: tokenId ? [BigInt(tokenId)] : undefined
  })
  const approved = !!approvedTo && vault && approvedTo.toLowerCase() === vault.toLowerCase()
  // 預入状態（暫定: localStorageのフラグ）
  const deposited = typeof window !== 'undefined' && localStorage.getItem('borrow:lastDeposit') === 'ok'

  // SmartActionPanel アクション
  const { writeContract, data: txHash, isPending, error: txError } = useWriteContract()
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash })

  function onSmartClick() {
    const d = decision
    if (d.disabled) return
    if (d.nextStateHint === 'approve') {
      if (!isAddress(collection) || !tokenId || !isAddress(vault)) return
      const ABI = [
        { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] }
      ] as const
      writeContract({ abi: ABI, address: collection as Address, functionName: 'approve', args: [vault as Address, BigInt(tokenId)] })
    } else if (d.nextStateHint === 'deposit') {
      if (!isAddress(vault) || !isAddress(collection) || !tokenId) return
      const ABI = [
        { type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [{ name: 'collection', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] }
      ] as const
      writeContract({ abi: ABI, address: vault as Address, functionName: 'deposit', args: [collection as Address, BigInt(tokenId)] })
    } else if (d.nextStateHint === 'borrow') {
      if (!isAddress(loanManager) || !isAddress(collection) || !tokenId || !isAddress(currency) || !amount || !decimals) return
      const ABI = [
        { type: 'function', name: 'openLoan', stateMutability: 'nonpayable', inputs: [
          { name: 'collection', type: 'address' }, { name: 'tokenId', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'currency', type: 'address' }
        ], outputs: [{ name: 'loanId', type: 'uint256' }] }
      ] as const
      let parsed
      try {
        parsed = parseUnits(String(amount), Number(decimals))
      } catch {
        return
      }
      writeContract({ abi: ABI, address: loanManager as Address, functionName: 'openLoan', args: [collection as Address, BigInt(tokenId), parsed, currency as Address] })
    }
  }

  // Tx 成功時のローカルフラグ
  useEffect(() => {
    if (isMined && decision.nextStateHint === 'deposit') {
      localStorage.setItem('borrow:lastDeposit', 'ok')
    }
  }, [isMined])

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

      <EvaluationBanner
        valueUsd={remote?.valueUsd}
        effectiveLtv={remote?.effectiveLTV}
        maxBorrowUsd={remote?.maxBorrowUsd}
        healthFactor={remote?.healthFactor}
      />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <BorrowChecklist walletConnected={isConnected} approved={approved} deposited={deposited} evaluated={!!remote} />
        <SmartActionPanel state={{ ...uiState, isApproved: approved, isDeposited: deposited }} onClick={onSmartClick} />
      </div>

      <div className="card">
        <h3>入力（アドレス）</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <label>
            コレクション
            <input placeholder="0x..." value={collection} onChange={(e) => setCollection(e.target.value)} />
          </label>
          <label>
            tokenId
            <input placeholder="123" value={tokenId} onChange={(e) => setTokenId(e.target.value)} />
          </label>
          <label>
            Vault
            <input placeholder="0x..." value={vault} onChange={(e) => setVault(e.target.value)} />
          </label>
          <label>
            LoanManager
            <input placeholder="0x..." value={loanManager} onChange={(e) => setLoanManager(e.target.value)} />
          </label>
          <label>
            通貨(USDC等)
            <input placeholder="0x..." value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </label>
          <label>
            小数桁(decimals)
            <input placeholder="6" value={decimals} onChange={(e) => setDecimals(e.target.value)} />
          </label>
        </div>
        {(isPending || isMining) && <p style={{ color: '#9aa0a6' }}>送信中...</p>}
        {txHash && <p style={{ color: '#9aa0a6' }}>Tx: {txHash}</p>}
        {txError && <p style={{ color: '#f87171' }}>{txError.message}</p>}
      </div>
    </section>
  )
}
