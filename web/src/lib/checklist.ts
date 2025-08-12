export function isEvalFresh(fetchedAt?: number, ttlSec = 300): boolean {
  if (!fetchedAt) return false
  const now = Math.floor(Date.now() / 1000)
  return now - fetchedAt <= ttlSec
}


