export function isEvalFresh(fetchedAt?: number, ttlSec = 300): boolean {
  if (!fetchedAt) return false
  const now = Math.floor(Date.now() / 1000)
  return now - fetchedAt <= ttlSec
}

export type ChecklistState = {
  walletConnected: boolean
  approved: boolean
  deposited: boolean
  evaluated: boolean
}

export function deriveChecklistState(params: {
  isConnected: boolean
  approvedTo?: string | null
  vault?: string | null
  evalFetchedAt?: number
  ttlSec?: number
  depositedFlag?: boolean
}): ChecklistState {
  const { isConnected, approvedTo, vault, evalFetchedAt, ttlSec = 300, depositedFlag } = params
  const approved = !!approvedTo && !!vault && approvedTo.toLowerCase() === vault.toLowerCase()
  const evaluated = isEvalFresh(evalFetchedAt, ttlSec)
  const deposited = !!depositedFlag
  return { walletConnected: isConnected, approved, deposited, evaluated }
}


