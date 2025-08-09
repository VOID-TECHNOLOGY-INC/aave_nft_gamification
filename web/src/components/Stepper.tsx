import { ReactNode } from 'react'

export type Step = {
  title: string
  content?: ReactNode
}

export function Stepper({ steps, active }: { steps: Step[]; active: number }) {
  return (
    <ol style={{ display: 'flex', gap: 12, listStyle: 'none', padding: 0, margin: '12px 0' }}>
      {steps.map((s, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              display: 'inline-grid',
              placeItems: 'center',
              background: i <= active ? '#4f46e5' : '#1f2937',
              color: 'white',
              fontSize: 12
            }}
          >
            {i + 1}
          </span>
          <span>{s.title}</span>
          {i < steps.length - 1 && <span style={{ color: '#2a3441', marginLeft: 8 }}>→</span>}
        </li>
      ))}
    </ol>
  )
}
