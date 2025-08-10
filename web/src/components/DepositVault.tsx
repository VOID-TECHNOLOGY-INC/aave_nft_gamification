import { useState } from 'react'
import { CONFIG } from '@/config'
import { Address, isAddress } from 'viem'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'

const VAULT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collection', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    outputs: []
  }
] as const

export default function DepositVault() {
  const [collection, setCollection] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [vault, setVault] = useState(CONFIG.vaultAddress ?? '')

  const { data: hash, isPending, writeContract, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const valid = isAddress(vault) && isAddress(collection) && tokenId.length > 0

  function onDeposit() {
    if (!valid) return
    writeContract({
      abi: VAULT_ABI,
      address: vault as Address,
      functionName: 'deposit',
      args: [collection as Address, BigInt(tokenId)]
    })
  }

  return (
    <div className="card">
      <h4>Step 2: Vaultに預入</h4>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
      </div>
      <button className="primary" onClick={onDeposit} disabled={!valid || isPending || isConfirming}>
        {isPending || isConfirming ? '送信中...' : '預入を送信'}
      </button>
      {hash && <p style={{ color: '#9aa0a6' }}>Tx Hash: {hash}</p>}
      {isConfirmed && <p style={{ color: '#10b981' }}>預入トランザクションが確定しました</p>}
      {error && <p style={{ color: '#f87171' }}>{error.message}</p>}
      {!isAddress(vault) && <p style={{ color: '#f59e0b' }}>環境変数 VITE_VAULT_ADDRESS を設定すると自動入力されます</p>}
    </div>
  )
}
