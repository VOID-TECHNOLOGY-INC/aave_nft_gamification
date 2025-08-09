import { useState } from 'react'
import { CONFIG } from '@/config'

export default function DepositVault() {
  const [nft, setNft] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [vault, setVault] = useState(CONFIG.vaultAddress ?? '')
  const [done, setDone] = useState(false)

  function onDeposit() {
    // モック: 実コントラクト接続前のダミー成功
    setTimeout(() => setDone(true), 400)
  }

  return (
    <div className="card">
      <h4>Step 2: Vaultに預入（モック）</h4>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <label>
          NFTコントラクト
          <input placeholder="0x..." value={nft} onChange={(e) => setNft(e.target.value)} />
        </label>
        <label>
          tokenId
          <input placeholder="123" value={tokenId} onChange={(e) => setTokenId(e.target.value)} />
        </label>
        <label>
          Vault
          <input placeholder="0x..." value={vault} onChange={(e) => setVault(e.target.value)} />
        </label>
      </div>
      <button className="primary" onClick={onDeposit}>預入（モック）</button>
      {done && <p style={{ color: '#10b981' }}>預入が完了した想定で次に進めます</p>}
    </div>
  )
}
