import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ProjectCard from './ProjectCard'
import AddProjectModal from './AddProjectModal'

export default function HomePage({ onOpenProject }) {
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchProjects()

    const channel = supabase
      .channel('home-projects')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        handleChange
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setProjects(data ?? [])
    setLoading(false)
  }

  function handleChange({ eventType, new: next, old: prev }) {
    setProjects(current => {
      switch (eventType) {
        case 'INSERT': return [next, ...current]
        case 'UPDATE': return current.map(p => p.id === next.id ? next : p)
        case 'DELETE': return current.filter(p => p.id !== prev.id)
        default: return current
      }
    })
  }

  if (loading) {
    return (
      <div className="home-page animate-fade-in">
        <div className="home-header">
          <div>
            <div className="skeleton" style={{ width: 120, height: 26, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 180, height: 16 }} />
          </div>
        </div>
        <div className="project-grid stagger">
          {[1, 2, 3].map(i => (
            <div key={i} className="project-card-skeleton skeleton" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="home-page animate-fade-up">
      <div className="home-header">
        <div>
          <h1 className="home-title">Proyectos</h1>
          <p className="home-subtitle">
            {projects.length === 0
              ? 'Sin proyectos todavía'
              : `${projects.length} repositorio${projects.length !== 1 ? 's' : ''} vinculado${projects.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Añadir proyecto
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="home-empty animate-fade-up">
          <svg width="52" height="52" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="8" fill="#a51500" fillOpacity="0.1" />
            <path d="M8 28L14 11L21 22L25.5 15L33 28H8Z" fill="#a51500" fillOpacity="0.55" />
          </svg>
          <h2 className="home-empty__title">Sin proyectos todavía</h2>
          <p className="home-empty__desc">
            Añade un repositorio de GitHub para empezar a gestionar tareas con el tablero Kanban.
          </p>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            Añadir primer proyecto
          </button>
        </div>
      ) : (
        <div className="project-grid stagger">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onOpenProject(project)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <AddProjectModal
          existingProjects={projects}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
