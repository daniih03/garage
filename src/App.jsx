import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { setStoredProviderToken, clearStoredProviderToken } from './lib/github'
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
  const [activeUserRole,  setActiveUserRole]  = useState(null)
  const [homeRefreshKey,  setHomeRefreshKey]  = useState(0)

  useEffect(() => {
    // 1. Auto-logout on new deploy
    const currentBuild = typeof __GARAGE_BUILD_TIME__ !== 'undefined' ? __GARAGE_BUILD_TIME__ : null
    if (currentBuild) {
      const storedBuild = localStorage.getItem('garage_last_build_time')
      if (storedBuild && storedBuild !== currentBuild) {
        console.log('[Deploy] New version detected, auto-logging out...')
        localStorage.setItem('garage_last_build_time', currentBuild)
        clearStoredProviderToken()
        supabase.auth.signOut().then(() => {
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname)
          }
          setSession(null)
          setLoading(false)
        })
        return
      }
      localStorage.setItem('garage_last_build_time', currentBuild)
    }

    // 2. Load session
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

    // 3. Check for new deployments on tab focus & interval
    async function checkServerDeploy() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}build-meta.json?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.buildTime && currentBuild && data.buildTime !== currentBuild) {
            console.log('[Deploy] Newer build deployed on server, auto-logging out...')
            localStorage.setItem('garage_last_build_time', data.buildTime)
            clearStoredProviderToken()
            await supabase.auth.signOut()
            window.location.reload()
          }
        }
      } catch {
        // Ignore offline / network errors
      }
    }

    window.addEventListener('focus', checkServerDeploy)
    const interval = setInterval(checkServerDeploy, 60000)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('focus', checkServerDeploy)
      clearInterval(interval)
    }
  }, [])

  function openProject(project) {
    setActiveProject(project)
    setActiveMilestone(null)
    setActiveUserRole(null)
    setView('project')
  }

  function goHome() {
    setView('home')
    setActiveProject(null)
    setActiveMilestone(null)
    setActiveUserRole(null)
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
        userRole={activeUserRole}
        onGoHome={goHome}
        onRefreshHome={() => setHomeRefreshKey(prev => prev + 1)}
      />
      <main className="main-content">
        {view === 'home' && (
          <HomePage
            key={homeRefreshKey}
            onOpenProject={openProject}
          />
        )}
        {view === 'project' && activeProject && (
          <ProjectView
            project={activeProject}
            activeMilestone={activeMilestone}
            onMilestoneChange={setActiveMilestone}
            onProjectUpdate={setActiveProject}
            onDeleteProject={goHome}
            onRoleDetected={setActiveUserRole}
          />
        )}
      </main>
    </div>
  )
}
