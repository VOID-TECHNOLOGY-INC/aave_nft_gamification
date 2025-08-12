import { describe, it, expect } from 'vitest'
import { decideCta, UiState } from '../lib/cta'

function baseState(): UiState {
  return {
    isConnected: true,
    isApproved: true,
    isDeposited: true,
    amountUsd: 100,
    networkOk: true,
    evalSnap: {
      valueUsd: 1000,
      effectiveLtv: 0.3,
      maxBorrowUsd: 300,
      healthFactor: 1.5,
      confidence: 0.7,
      liquidity: 0.8,
      volatility: 0.2,
      circuitFlags: [],
      fetchedAt: Math.floor(Date.now() / 1000)
    }
  }
}

describe('decideCta', () => {
  it('should suggest connect when disconnected', () => {
    const s = baseState(); s.isConnected = false
    const d = decideCta(s)
    expect(d.label).toContain('ウォレット接続')
    expect(d.disabled).toBe(false)
  })

  it('should ask for approve when not approved', () => {
    const s = baseState(); s.isApproved = false
    const d = decideCta(s)
    expect(d.label).toContain('承認')
    expect(d.disabled).toBe(false)
  })

  it('should ask for deposit when not deposited', () => {
    const s = baseState(); s.isDeposited = false
    const d = decideCta(s)
    expect(d.label).toContain('預入')
    expect(d.disabled).toBe(false)
  })

  it('should allow borrow when guards pass', () => {
    const s = baseState()
    const d = decideCta(s)
    expect(d.label).toContain('借入')
    expect(d.disabled).toBe(false)
  })

  it('should block when evaluation expired', () => {
    const s = baseState(); if (s.evalSnap) s.evalSnap.fetchedAt = Math.floor(Date.now()/1000) - 3600
    const d = decideCta(s)
    expect(d.disabled).toBe(true)
    expect(d.reason).toContain('評価が有効ではありません')
  })

  it('should block on circuit flags', () => {
    const s = baseState(); if (s.evalSnap) s.evalSnap.circuitFlags = ['EMERGENCY_STOP']
    const d = decideCta(s)
    expect(d.disabled).toBe(true)
    expect(d.reason).toContain('一時停止')
  })

  it('should block on low confidence', () => {
    const s = baseState(); if (s.evalSnap) s.evalSnap.confidence = 0.5
    const d = decideCta(s)
    expect(d.disabled).toBe(true)
    expect(d.reason).toContain('信頼性')
  })

  it('should block when amount exceeds safety limit', () => {
    const s = baseState(); s.amountUsd = 400
    const d = decideCta(s)
    expect(d.disabled).toBe(true)
    expect(d.reason).toContain('上限')
  })

  it('should block when HF below min', () => {
    const s = baseState(); if (s.evalSnap) s.evalSnap.healthFactor = 1.1
    const d = decideCta(s)
    expect(d.disabled).toBe(true)
    expect(d.reason).toContain('健全性')
  })
})


