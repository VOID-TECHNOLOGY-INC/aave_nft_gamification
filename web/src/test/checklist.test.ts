import { describe, it, expect } from 'vitest'
import { isEvalFresh, deriveChecklistState } from '../lib/checklist'

describe('checklist utils', () => {
  it('isEvalFresh true within TTL', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isEvalFresh(now - 100, 300)).toBe(true)
  })
  it('isEvalFresh false when expired', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isEvalFresh(now - 400, 300)).toBe(false)
  })
  it('isEvalFresh false when missing timestamp', () => {
    expect(isEvalFresh(undefined, 300)).toBe(false)
  })
})

it('deriveChecklistState computes flags correctly', () => {
  const now = Math.floor(Date.now() / 1000)
  const s = deriveChecklistState({
    isConnected: true,
    approvedTo: '0xVault',
    vault: '0xvault',
    evalFetchedAt: now - 10,
    ttlSec: 300,
    depositedFlag: true
  })
  expect(s.walletConnected).toBe(true)
  expect(s.approved).toBe(true)
  expect(s.deposited).toBe(true)
  expect(s.evaluated).toBe(true)
})


