import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchUserRepos } from '../../lib/github'
import ProjectCard from './ProjectCard'
import AddProjectModal from './AddProjectModal'
import EditProjectModal from './EditProjectModal'
import DangerConfirmModal from '../Common/DangerConfirmModal'

export default function HomePage({ onOpenProject }) {
  const [projects,           setProjects]           = useState([])
  const [currentUser,        setCurrentUser]        = useState(null)
  const [loading,            setLoading]            = useState(true)
  const [showModal,          setShowModal]          = useState(false)
  const [projectToEdit,      setProjectToEdit]      = useState(null)
  const [projectToDelete,    setProjectToDelete]    = useState(null)

  useEffect(() => {
    let active = true

    async function syncAndFetch() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const username = session?.user?.user_metadata?.user_name
        let repoNames = []

        if (session?.provider_token) {
          try {
            const userRepos = await fetchUserRepos(session.provider_token)
            if (Array.isArray(userRepos)) {
              repoNames = userRepos.map(r => r.full_name)
            }
          } catch (e) {
            console.warn('Could not fetch GitHub repos for auto-sync', e)
          }
        }

        // Actualizar perfil de GitHub (ya no auto-enrola en proyectos)
        await supabase.rpc('sync_user_projects', {
          user_repos: repoNames,
          github_user: username || null,
        })
      } catch (err) {
        console.warn('Auto-sync projects notice', err)
      } finally {
        if (active) {
          await fetchProjects()
        }
      }
    }

    syncAndFetch()

    const channel = supabase
      .channel('home-projects')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => fetchProjects()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'project_members' },
        () => fetchProjects()
      )
      .subscribe()

    const onFocus = () => syncAndFetch()
    window.addEventListener('focus', onFocus)

    return () => {
      active = false
      supabase.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  async function fetchProjects() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    setCurrentUser(user)

    let acceptedIds = new Set()
    let declinedIds = new Set()
    try {
      acceptedIds = new Set(JSON.parse(localStorage.getItem(`garage_accepted_invites_${user.id}`) || '[]'))
      declinedIds = new Set(JSON.parse(localStorage.getItem(`garage_declined_invites_${user.id}`) || '[]'))
    } catch {}

    // Fetch user memberships to know roles and who invited them
    const { data: memberships } = await supabase
      .from('project_members')
      .select('project_id, added_by, added_at, role')
      .eq('user_id', user.id)

    const memberMap = new Map((memberships ?? []).map(m => [m.project_id, m]))

    const { data: allProjects, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && allProjects) {
      const activeList = []

      for (const proj of allProjects) {
        if (declinedIds.has(proj.id)) continue

        const mem = memberMap.get(proj.id)
        const isCreator = proj.created_by === user.id
        const isOwner = isCreator || mem?.role === 'owner'
        const wasInvitedByOther = mem?.added_by && mem.added_by !== user.id

        // Si fue invitado por otro y aún no ha aceptado desde la campana, no se muestra en el grid
        if (wasInvitedByOther && !isCreator && !acceptedIds.has(proj.id)) {
          continue
        }

        activeList.push({
          ...proj,
          isOwner,
        })
      }

      setProjects(activeList)
    }
    setLoading(false)
  }

  async function handleDeleteProject(proj) {
    setProjects(current => current.filter(p => p.id !== proj.id))
    const { error } = await supabase.from('projects').delete().eq('id', proj.id)
    if (error) fetchProjects()
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
          <img
            src={`${import.meta.env.BASE_URL}logos/Command_NOBG_Blanco_C.png`}
            alt="Garage"
            className="home-empty__logo"
            width="72"
            height="72"
          />
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
              isOwner={project.isOwner}
              onClick={() => onOpenProject(project)}
              onEdit={() => setProjectToEdit(project)}
              onDelete={project.isOwner ? () => setProjectToDelete(project) : null}
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

      {projectToEdit && (
        <EditProjectModal
          project={projectToEdit}
          onProjectUpdated={updated => {
            setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
          }}
          onClose={() => setProjectToEdit(null)}
        />
      )}

      {projectToDelete && (
        <DangerConfirmModal
          title="¿Eliminar proyecto definitivamente?"
          targetName={`${projectToDelete.repo_name} (${projectToDelete.repo_full_name})`}
          targetType="proyecto"
          message="Se eliminarán todos los hitos, tarjetas, etiquetas, comentarios y miembros de forma irreversible."
          confirmText="Eliminar proyecto"
          onConfirm={() => handleDeleteProject(projectToDelete)}
          onClose={() => setProjectToDelete(null)}
        />
      )}
    </div>
  )
}
