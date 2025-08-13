import { describe, it, expect } from 'vitest'
import { estimateUsdCost } from '../lib/gas'

describe('gas utils', () => {
  it('estimateUsdCost basic conversion', () => {
    const gas = 21000n
    const gasPrice = 20_000_000_000n // 20 gwei
    const ethUsd1e8 = 300_000_000_000n  // $3000 in 1e8
    const usd = estimateUsdCost({ gas, gasPrice, ethUsdPrice1e8: ethUsd1e8 })
    // 21000 * 20 gwei = 420,000 gwei = 0.00042 ETH -> * $3000 = $1.26
    expect(usd).toBeCloseTo(1.26, 2)
  })
})


