export type LoanMathParams = {
  a1?: number
  a2?: number
  a3?: number
  ltvMin?: number
  ltvMax?: number
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

export function computeEffectiveLTV(
  baseLTV: number,
  confidence: number,
  liquidity: number,
  volatility: number,
  params: LoanMathParams = {}
): number {
  const { a1 = 0.6, a2 = 0.3, a3 = 0.4, ltvMin = 0.15, ltvMax = 0.45 } = params
  const adj = clamp(a1 * confidence + a2 * liquidity - a3 * volatility, 0, 1)
  const effective = baseLTV * (0.7 + 0.3 * adj)
  return clamp(effective, ltvMin, ltvMax)
}

export function computeHealthFactor(
  collateralValueUsd: number,
  effectiveLTV: number,
  debtUsd: number
): number {
  if (debtUsd <= 0) return Infinity
  return (collateralValueUsd * effectiveLTV) / debtUsd
}

export function from1e8(x: number): number {
  return x / 1e8
}

export function to1e8(x: number): number {
  return Math.round(x * 1e8)
}

export function getQuoteUSD(args: {
  price1e8: number
  baseLTV: number
  confidence: number
  liquidity: number
  volatility: number
  debt?: number
  params?: LoanMathParams
}) {
  const { price1e8, baseLTV, confidence, liquidity, volatility, debt = 0, params } = args
  const valueUsd = from1e8(price1e8)
  const effectiveLTV = computeEffectiveLTV(baseLTV, confidence, liquidity, volatility, params)
  const maxBorrowUsd = valueUsd * effectiveLTV
  const healthFactor = computeHealthFactor(valueUsd, effectiveLTV, debt)
  return { valueUsd, effectiveLTV, maxBorrowUsd, healthFactor }
}
