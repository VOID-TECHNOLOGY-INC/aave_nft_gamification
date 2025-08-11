import { useEffect, useMemo, useState } from 'react'
import { CONFIG } from '@/config'
import { Address, isAddress, parseUnits } from 'viem'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'

const LOAN_MANAGER_ABI = [
  {
    type: 'function',
    name: 'openLoan',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collection', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'currency', type: 'address' }
    ],
    outputs: [ { name: 'loanId', type: 'uint256' } ]
  }
] as const

export default function OpenLoan() {
  const [loanManager, setLoanManager] = useState(CONFIG.loanManagerAddress ?? '')
  const [collection, setCollection] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [currency, setCurrency] = useState('')
  const [decimals, setDecimals] = useState('6') // USDC想定デフォルト
  const [amount, setAmount] = useState('') // 人間可読の額（例: 100.5）

  const { data: hash, isPending, writeContract, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash })

  const valid = isAddress(loanManager) && isAddress(collection) && tokenId.length > 0 && isAddress(currency) && amount.length > 0 && Number(decimals) >= 0

  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount as `${number}`, Number(decimals))
    } catch {
      return undefined
    }
  }, [amount, decimals])

  function onOpen() {
    if (!valid || parsedAmount === undefined) return
    writeContract({
      abi: LOAN_MANAGER_ABI,
      address: loanManager as Address,
      functionName: 'openLoan',
      args: [collection as Address, BigInt(tokenId), parsedAmount, currency as Address]
    })
  }

  // loanId抽出（イベントやreturn dataのdecodingがUI簡易のため困難な時はTxのlogs解析が必要）
  const [loanId, setLoanId] = useState<string | null>(null)
  useEffect(() => {
    if (isConfirmed) {
      // 簡易: EVMはreturn dataを直接取り出せないため、ここではTx成功をもって成功表示に留める
      setLoanId('created (check explorer logs)')
    }
  }, [isConfirmed])

  return (
    <div className="card">
      <h4>Step 3: Loan Open</h4>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <label>
          LoanManager
          <input placeholder="0x..." value={loanManager} onChange={(e) => setLoanManager(e.target.value)} />
        </label>
        <label>
          コレクション
          <input placeholder="0x..." value={collection} onChange={(e) => setCollection(e.target.value)} />
        </label>
        <label>
          tokenId
          <input placeholder="123" value={tokenId} onChange={(e) => setTokenId(e.target.value)} />
        </label>
        <label>
          通貨（USDC等）
          <input placeholder="0x..." value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </label>
        <label>
          金額
          <input placeholder="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          小数桁(decimals)
          <input placeholder="6" value={decimals} onChange={(e) => setDecimals(e.target.value)} />
        </label>
      </div>
      <button className="primary" onClick={onOpen} disabled={!valid || parsedAmount === undefined || isPending || isConfirming}>
        {isPending || isConfirming ? '送信中...' : '借入実行を送信'}
      </button>
      {hash && <p style={{ color: '#9aa0a6' }}>Tx Hash: {hash}</p>}
      {isConfirmed && <p style={{ color: '#10b981' }}>借入が確定しました（loanId: {loanId ?? '-'}）</p>}
      {error && <p style={{ color: '#f87171' }}>{error.message}</p>}
      {!isAddress(loanManager) && <p style={{ color: '#f59e0b' }}>環境変数 VITE_LOAN_MANAGER_ADDRESS を設定すると自動入力されます</p>}
    </div>
  )
}
