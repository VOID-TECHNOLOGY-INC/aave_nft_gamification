import { createPublicClient, http, Address, getContract } from 'viem'
import { baseSepolia } from 'viem/chains'
// ABI is exported by @aave/core-v3 as JSON artifacts
import PoolArtifact from '@aave/core-v3/artifacts/contracts/protocol/pool/Pool.sol/Pool.json'

export type AaveConfig = {
  poolAddress: Address
}

export function createAaveClient(config: AaveConfig) {
  const client = createPublicClient({ chain: baseSepolia, transport: http() })
  const pool = getContract({
    address: config.poolAddress,
    abi: PoolArtifact.abi,
    client
  })
  return { client, pool }
}

// Note: For testnets, you must set a valid pool address via env/config.
