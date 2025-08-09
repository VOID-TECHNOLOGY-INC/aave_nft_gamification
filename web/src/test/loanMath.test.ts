import { describe, it, expect } from 'vitest'
import { clamp, computeEffectiveLTV, computeHealthFactor, getQuoteUSD, to1e8 } from '@/lib/loanMath'

describe('loanMath', () => {
  it('clamp works', () => {
    expect(clamp(1.2, 0, 1)).toBe(1)
    expect(clamp(-0.1, 0, 1)).toBe(0)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })

  it('effective LTV follows formula with bounds', () => {
    // Worst inputs lead to adj=0 => effective = base*(0.7) = 0.28, then bounded [0.15,0.45]
    expect(computeEffectiveLTV(0.4, 0, 0, 1)).toBeCloseTo(0.28, 5)
    // Use larger baseLTV to exceed max and trigger clamp to 0.45
    expect(computeEffectiveLTV(0.6, 1, 1, 0)).toBeCloseTo(0.45, 5)
  })

  it('HF increases when debt decreases', () => {
    const value1e8 = to1e8(100)
    const q1 = getQuoteUSD({ price1e8: value1e8, baseLTV: 0.35, confidence: 0.7, liquidity: 0.6, volatility: 0.3, debt: 50 })
    const q2 = getQuoteUSD({ price1e8: value1e8, baseLTV: 0.35, confidence: 0.7, liquidity: 0.6, volatility: 0.3, debt: 40 })
    expect(q2.healthFactor).toBeGreaterThan(q1.healthFactor)
  })

  it('HF is Infinity when no debt', () => {
    expect(computeHealthFactor(100, 0.3, 0)).toBe(Infinity)
  })
})
