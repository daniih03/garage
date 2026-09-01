import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './components/Auth/LoginPage'
import Board from './components/Board/Board'
import Header from './components/Layout/Header'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore existing session on load (handles OAuth callback hash too)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" aria-label="Cargando..." />
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  return (
    <div className="app">
      <Header user={session.user} />
      <main className="main-content">
        <Board />
      </main>
    </div>
  )
}
