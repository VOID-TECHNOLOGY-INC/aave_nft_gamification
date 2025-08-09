import { NavLink } from 'react-router-dom'
import Connect from './Connect'

export default function NavBar() {
  return (
    <header className="navbar">
      <div className="brand">Aave NFT Lend (MVP)</div>
      <nav className="nav-links">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/borrow">Borrow</NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/repay">Repay</NavLink>
      </nav>
      <Connect />
    </header>
  )
}
