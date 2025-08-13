import { Address } from 'viem'

export type GasEstimationInput = {
  gas: bigint
  gasPrice: bigint
  ethUsdPrice1e8: bigint
}

export function estimateUsdCost({ gas, gasPrice, ethUsdPrice1e8 }: GasEstimationInput): number {
  // gas * gasPrice = wei, convert to ETH then to USD using 1e8 price feed
  const wei = gas * gasPrice
  const eth = Number(wei) / 1e18
  const usd = eth * Number(ethUsdPrice1e8) / 1e8
  return usd
}


