import { Outlet, Link, NavLink } from 'react-router-dom'
import NavBar from './components/NavBar'

export default function App() {
  return (
    <div className="app-container">
      <NavBar />
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="footer">
        <span>© {new Date().getFullYear()} NFT Lend + Gamification</span>
        <nav className="footer-nav">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/borrow">Borrow</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/repay">Repay</NavLink>
        </nav>
      </footer>
    </div>
  )
}
