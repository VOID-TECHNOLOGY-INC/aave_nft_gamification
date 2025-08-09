import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import Home from './pages/Home'
import Borrow from './pages/Borrow'
import Dashboard from './pages/Dashboard'
import Repay from './pages/Repay'
import { WalletProvider } from './wallet'
import './styles.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'borrow', element: <Borrow /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'repay', element: <Repay /> }
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <RouterProvider router={router} />
    </WalletProvider>
  </React.StrictMode>
)
