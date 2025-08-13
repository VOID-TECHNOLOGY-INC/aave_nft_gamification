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

export type GasEstimateResult =
  | { ok: true; gas: bigint; gasPrice: bigint; usd: number }
  | { ok: false; message: string }

export async function tryEstimateTxUsd(params: {
  estimate: () => Promise<bigint>
  getGasPrice: () => Promise<bigint>
  ethUsdPrice1e8: bigint
}): Promise<GasEstimateResult> {
  try {
    const [gas, gasPrice] = await Promise.all([params.estimate(), params.getGasPrice()])
    const usd = estimateUsdCost({ gas, gasPrice, ethUsdPrice1e8: params.ethUsdPrice1e8 })
    return { ok: true, gas, gasPrice, usd }
  } catch (e: any) {
    const message = e?.shortMessage || e?.message || '見積りに失敗しました'
    return { ok: false, message }
  }
}


