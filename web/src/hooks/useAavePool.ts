import { useMemo } from 'react'
import { usePublicClient } from 'wagmi'
import { getContract, Address } from 'viem'
import PoolArtifact from '@aave/core-v3/artifacts/contracts/protocol/pool/Pool.sol/Pool.json'
import { CONFIG } from '@/config'

export function useAavePool() {
  const client = usePublicClient()
  const poolAddress = CONFIG.aavePoolAddress

  const pool = useMemo(() => {
    if (!client || !poolAddress) return undefined
    return getContract({ address: poolAddress as Address, abi: PoolArtifact.abi, client })
  }, [client, poolAddress])

  return { pool, ready: Boolean(pool) }
}
