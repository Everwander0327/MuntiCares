import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { PresenceProvider } from './contexts/PresenceContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <PresenceProvider>
          <App />
        </PresenceProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
)
