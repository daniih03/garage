import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { setStoredProviderToken } from './lib/github'
import LoginPage from './components/Auth/LoginPage'
import Header from './components/Layout/Header'
import HomePage from './components/Home/HomePage'
import ProjectView from './components/Project/ProjectView'

export default function App() {
  const [session, setSession]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [view, setView]                     = useState('home')        // 'home' | 'project'
  const [activeProject, setActiveProject]   = useState(null)
  const [activeMilestone, setActiveMilestone] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.provider_token) {
        setStoredProviderToken(session.provider_token)
      }
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.provider_token) {
          setStoredProviderToken(session.provider_token)
        }
        setSession(session)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  function openProject(project) {
    setActiveProject(project)
    setActiveMilestone(null)
    setView('project')
  }

  function goHome() {
    setView('home')
    setActiveProject(null)
    setActiveMilestone(null)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" aria-label="Cargando…" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <div className="app">
      <Header
        user={session.user}
        view={view}
        activeProject={activeProject}
        onGoHome={goHome}
      />
      <main className="main-content">
        {view === 'home' && (
          <HomePage onOpenProject={openProject} />
        )}
        {view === 'project' && activeProject && (
          <ProjectView
            project={activeProject}
            activeMilestone={activeMilestone}
            onMilestoneChange={setActiveMilestone}
            onDeleteProject={goHome}
          />
        )}
      </main>
    </div>
  )
}
