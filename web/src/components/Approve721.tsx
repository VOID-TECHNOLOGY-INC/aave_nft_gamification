import { useState } from 'react'
import { Address, isAddress } from 'viem'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { CONFIG } from '@/config'

const ERC721_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    outputs: []
  }
] as const

export default function Approve721() {
  const [nft, setNft] = useState('')
  const [tokenId, setTokenId] = useState<string>('')
  const [to, setTo] = useState<string>(CONFIG.vaultAddress ?? '')

  const { data: hash, isPending, writeContract, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const canSend = isAddress(nft) && !!tokenId && isAddress(to)

  function onApprove() {
    if (!canSend) return
    writeContract({
      abi: ERC721_ABI,
      address: nft as Address,
      functionName: 'approve',
      args: [to as Address, BigInt(tokenId)]
    })
  }

  return (
    <div className="card">
      <h4>Step 1: 承認（ERC-721 approve）</h4>
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
          承認先（Vault）
          <input placeholder="0x..." value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <button className="primary" onClick={onApprove} disabled={!canSend || isPending || isConfirming}>
        {isPending || isConfirming ? '送信中...' : '承認を送信'}
      </button>
      {hash && <p style={{ color: '#9aa0a6' }}>Tx Hash: {hash}</p>}
      {isConfirmed && <p style={{ color: '#10b981' }}>承認が確定しました</p>}
      {error && <p style={{ color: '#f87171' }}>{error.message}</p>}
    </div>
  )
}
