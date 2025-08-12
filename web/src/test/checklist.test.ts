import { describe, it, expect } from 'vitest'
import { isEvalFresh } from '../lib/checklist'

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


