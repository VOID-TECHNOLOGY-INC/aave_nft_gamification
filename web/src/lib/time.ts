export function formatRelativeTime(epochSec?: number): string {
  if (!epochSec) return '—'
  const now = Math.floor(Date.now() / 1000)
  const diff = now - epochSec
  if (diff < 0) return 'たった今'
  if (diff < 10) return 'たった今'
  if (diff < 60) return `${diff}秒前`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  const d = Math.floor(h / 24)
  return `${d}日前`
}


