export type QuoteParams = {
  priceUsd: number
  baseLTV: number
  confidence: number
  liquidity: number
  volatility: number
  debt: number
}

export type QuoteResponse = {
  valueUsd: number
  effectiveLTV: number
  maxBorrowUsd: number
  healthFactor: number
}

function buildFunctionsUrl(functionName: string) {
  const project = import.meta.env.VITE_FIREBASE_PROJECT_ID as string
  const region = (import.meta.env.VITE_FIREBASE_REGION as string) || 'us-central1'
  if (!project) throw new Error('VITE_FIREBASE_PROJECT_ID is not set')
  return `https://${region}-${project}.cloudfunctions.net/${functionName}`
}

export async function fetchQuoteSim(params: QuoteParams): Promise<QuoteResponse> {
  const url = new URL(buildFunctionsUrl('quoteSim'))
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) throw new Error(`quoteSim failed: ${res.status}`)
  return (await res.json()) as QuoteResponse
}
