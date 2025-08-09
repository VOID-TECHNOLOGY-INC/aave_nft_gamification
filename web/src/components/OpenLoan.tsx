import { useState } from 'react'
import { CONFIG } from '@/config'

export default function OpenLoan() {
  const [loanManager, setLoanManager] = useState(CONFIG.loanManagerAddress ?? '')
  const [collection, setCollection] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [currency, setCurrency] = useState('')
  const [amount, setAmount] = useState('')
  const [done, setDone] = useState(false)

  function onOpen() {
    // モック: 実コントラクト接続前のダミー成功
    setTimeout(() => setDone(true), 400)
  }

  return (
    <div className="card">
      <h4>Step 3: Loan Open（モック）</h4>
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
          金額(USD換算)
          <input placeholder="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      </div>
      <button className="primary" onClick={onOpen}>借入実行（モック）</button>
      {done && <p style={{ color: '#10b981' }}>借入が完了した想定です</p>}
    </div>
  )
}
