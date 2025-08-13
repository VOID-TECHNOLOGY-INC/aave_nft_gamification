import { describe, it, expect } from 'vitest'
import { UI_GUARDS, withOverrides } from '../lib/uiConfig'

describe('uiConfig', () => {
  it('withOverrides keeps defaults when env empty', () => {
    const c = withOverrides({})
    expect(c.thresholds.confidence.warn).toBe(UI_GUARDS.thresholds.confidence.warn)
    expect(c.evaluationTtlSec).toBe(UI_GUARDS.evaluationTtlSec)
  })
  it('withOverrides applies numeric env overrides', () => {
    const c = withOverrides({ VITE_UI_CONFIDENCE_WARN: '0.62', VITE_UI_EVAL_TTL_SEC: '600' })
    expect(c.thresholds.confidence.warn).toBe(0.62)
    expect(c.evaluationTtlSec).toBe(600)
  })
})


