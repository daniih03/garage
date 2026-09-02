import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import MilestoneBar from './MilestoneBar'
import InviteModal from './InviteModal'
import DangerConfirmModal from '../Common/DangerConfirmModal'
import Board from '../Board/Board'

export default function ProjectView({
  project,
  activeMilestone,
  onMilestoneChange,
  onDeleteProject,
}) {
  const [milestones,         setMilestones]         = useState([])
  const [members,            setMembers]            = useState([])
  const [loading,            setLoading]            = useState(true)
  const [showInvite,         setShowInvite]         = useState(false)
  const [showDeleteProject,  setShowDeleteProject]  = useState(false)

  useEffect(() => {
    fetchAll()

    const milestonesChannel = supabase
      .channel(`milestones-${project.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'milestones', filter: `project_id=eq.${project.id}` },
        handleMilestoneChange
      )
      .subscribe()

    const membersChannel = supabase
      .channel(`members-${project.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'project_members', filter: `project_id=eq.${project.id}` },
        () => fetchMembers()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(milestonesChannel)
      supabase.removeChannel(membersChannel)
    }
  }, [project.id])

  async function fetchAll() {
    await Promise.all([fetchMilestones(), fetchMembers()])
    setLoading(false)
  }

  async function fetchMilestones() {
    const { data } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', project.id)
      .order('number', { ascending: true })

    const list = data ?? []
    setMilestones(list)
    if (list.length > 0 && !activeMilestone) {
      onMilestoneChange(list[0])
    }
  }

  async function fetchMembers() {
    const { data: memberships } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', project.id)

    if (!memberships?.length) { setMembers([]); return }

    const ids = memberships.map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, github_username, avatar_url')
      .in('id', ids)

    setMembers(
      (profiles ?? []).map(p => ({ user_id: p.id, github_username: p.github_username, avatar_url: p.avatar_url }))
    )
  }

  function handleMilestoneChange({ eventType, new: next, old: prev }) {
    setMilestones(current => {
      switch (eventType) {
        case 'INSERT': {
          const updated = [...current, next].sort((a, b) => a.number - b.number)
          if (!activeMilestone) onMilestoneChange(next)
          return updated
        }
        case 'UPDATE': return current.map(m => m.id === next.id ? next : m)
        case 'DELETE': {
          const remaining = current.filter(m => m.id !== prev.id)
          if (activeMilestone?.id === prev.id) onMilestoneChange(remaining[0] ?? null)
          return remaining
        }
        default: return current
      }
    })
  }

  function handleDeleteMilestone(m) {
    setMilestones(prev => {
      const remaining = prev.filter(item => item.id !== m.id)
      if (activeMilestone?.id === m.id) {
        onMilestoneChange(remaining[0] ?? null)
      }
      return remaining
    })
  }

  function handleUpdateMilestone(updated) {
    setMilestones(prev => prev.map(item => item.id === updated.id ? updated : item))
    if (activeMilestone?.id === updated.id) {
      onMilestoneChange(updated)
    }
  }

  async function handleConfirmDeleteProject() {
    const { error } = await supabase.from('projects').delete().eq('id', project.id)
    if (!error && onDeleteProject) {
      onDeleteProject()
    }
  }

  if (loading) {
    return <div className="board-loading"><div className="loading-spinner" /></div>
  }

  return (
    <div className="project-view animate-fade-up">
      {/* Members bar */}
      <div className="members-bar">
        <div className="members-bar__avatars" aria-label="Miembros del proyecto">
          {members.map(m => (
            m.avatar_url
              ? <img
                  key={m.user_id}
                  src={m.avatar_url}
                  alt={m.github_username}
                  className="member-avatar"
                  title={`@${m.github_username}`}
                />
              : <div
                  key={m.user_id}
                  className="member-avatar member-avatar--placeholder"
                  title={`@${m.github_username}`}
                >
                  {m.github_username?.[0]?.toUpperCase() ?? '?'}
                </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setShowInvite(true)}
            aria-label="Invitar colaborador"
          >
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Invitar
          </button>
          <button
            className="btn btn--ghost btn--sm"
            style={{ color: 'var(--danger)', borderColor: 'rgba(231,76,60,0.25)' }}
            onClick={() => setShowDeleteProject(true)}
            aria-label="Eliminar proyecto"
            title="Eliminar proyecto"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Eliminar proyecto
          </button>
        </div>
      </div>

      <MilestoneBar
        project={project}
        milestones={milestones}
        activeMilestone={activeMilestone}
        onSelectMilestone={onMilestoneChange}
        onUpdateMilestone={handleUpdateMilestone}
        onDeleteMilestone={handleDeleteMilestone}
      />

      {milestones.length === 0 ? (
        <div className="project-empty animate-fade-up">
          <div className="project-empty__icon">🏁</div>
          <h2 className="project-empty__title">Sin hitos todavía</h2>
          <p className="project-empty__desc">
            Crea el primer hito para empezar a añadir tarjetas al tablero.
          </p>
        </div>
      ) : activeMilestone ? (
        <Board project={project} milestone={activeMilestone} />
      ) : null}

      {showInvite && (
        <InviteModal
          project={project}
          currentMembers={members}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showDeleteProject && (
        <DangerConfirmModal
          title="¿Eliminar proyecto definitivamente?"
          targetName={`${project.repo_name} (${project.repo_full_name})`}
          targetType="proyecto"
          message="Se eliminarán todos los hitos, tarjetas, etiquetas, comentarios y miembros de forma irreversible."
          confirmText="Eliminar proyecto"
          onConfirm={handleConfirmDeleteProject}
          onClose={() => setShowDeleteProject(false)}
        />
      )}
    </div>
  )
}
