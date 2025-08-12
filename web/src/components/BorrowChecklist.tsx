type Props = {
  walletConnected: boolean
  approved?: boolean
  deposited?: boolean
  evaluated?: boolean
  riskNote?: string | null
}

export default function BorrowChecklist(p: Props) {
  function Item({ ok, label }: { ok: boolean; label: string }) {
    return (
      <li className={ok ? 'check-fade-in' : ''} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{ok ? '✅' : '⏳'}</span>
        <span>{label}</span>
      </li>
    )
  }

  return (
    <div className="card">
      <h3>進行チェック</h3>
      <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
        <Item ok={p.walletConnected} label="ウォレット接続" />
        <Item ok={!!p.approved} label="承認済み" />
        <Item ok={!!p.deposited} label="Vault 預入済み" />
        <Item ok={!!p.evaluated} label="評価取得済み" />
      </ul>
      {p.riskNote && <p style={{ color: '#f59e0b', marginTop: 6 }}>{p.riskNote}</p>}
    </div>
  )
}


