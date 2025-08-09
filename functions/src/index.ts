/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'

function clamp(x: number, min: number, max: number) { return Math.min(Math.max(x, min), max) }
function computeEffectiveLTV(baseLTV: number, confidence: number, liquidity: number, volatility: number) {
  const a1 = 0.6, a2 = 0.3, a3 = 0.4, ltvMin = 0.15, ltvMax = 0.45
  const adj = clamp(a1 * confidence + a2 * liquidity - a3 * volatility, 0, 1)
  const effective = baseLTV * (0.7 + 0.3 * adj)
  return clamp(effective, ltvMin, ltvMax)
}
function computeHF(valueUsd: number, effectiveLTV: number, debtUsd: number) {
  if (debtUsd <= 0) return Infinity
  return (valueUsd * effectiveLTV) / debtUsd
}

export const health = onRequest({ cors: true }, (req, res) => {
  res.json({ ok: true, ts: Date.now() })
})

export const quoteSim = onRequest({ cors: true }, (req, res) => {
  const priceUsd = Number(req.query.priceUsd ?? '100')
  const baseLTV = Number(req.query.baseLTV ?? '0.35')
  const confidence = Number(req.query.confidence ?? '0.7')
  const liquidity = Number(req.query.liquidity ?? '0.6')
  const volatility = Number(req.query.volatility ?? '0.3')
  const debt = Number(req.query.debt ?? '0')

  const effectiveLTV = computeEffectiveLTV(baseLTV, confidence, liquidity, volatility)
  const maxBorrowUsd = priceUsd * effectiveLTV
  const hf = computeHF(priceUsd, effectiveLTV, debt)

  res.json({ valueUsd: priceUsd, effectiveLTV, maxBorrowUsd, healthFactor: hf })
})
