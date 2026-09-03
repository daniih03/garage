import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchRepoCollaboratorsDetails, getStoredProviderToken } from '../../lib/github'
import { generateProjectCSV, downloadCSV } from '../../lib/csvExportImport'
import { createUserNotification } from '../../lib/notifications'
import MilestoneBar from './MilestoneBar'
import MilestoneModal from './MilestoneModal'
import InviteModal from './InviteModal'
import ManageMembersModal from './ManageMembersModal'
import ImportProjectModal from './ImportProjectModal'
import EditProjectModal from '../Home/EditProjectModal'
import DangerConfirmModal from '../Common/DangerConfirmModal'
import Board from '../Board/Board'

export default function ProjectView({
  project,
  activeMilestone,
  onMilestoneChange,
  onProjectUpdate,
  onDeleteProject,
  onRoleDetected,
}) {
  const [milestones,         setMilestones]         = useState([])
  const [members,            setMembers]            = useState([])
  const [currentUser,        setCurrentUser]        = useState(null)
  const [currentUserRole,    setCurrentUserRole]    = useState(null)
  const [loading,            setLoading]            = useState(true)
  const [refreshing,         setRefreshing]         = useState(false)
  const [refreshKey,         setRefreshKey]         = useState(0)
  const [showInvite,         setShowInvite]         = useState(false)
  const [showManageMembers,  setShowManageMembers]  = useState(false)
  const [showCreateMilestone, setShowCreateMilestone] = useState(false)
  const [showEditProject,    setShowEditProject]    = useState(false)
  const [showDeleteProject,  setShowDeleteProject]  = useState(false)
  const [memberToKick,       setMemberToKick]       = useState(null)
  const [showLeaveConfirm,   setShowLeaveConfirm]   = useState(false)
  const [kickError,          setKickError]          = useState('')
  const [showImportModal,    setShowImportModal]    = useState(false)
  const [exporting,          setExporting]          = useState(false)

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetchAll()
      setRefreshKey(prev => prev + 1)
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  async function handleExportProject() {
    if (exporting) return
    setExporting(true)
    try {
      // 1. Obtener todos los hitos del proyecto
      const { data: mData } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', project.id)
        .order('number', { ascending: true })

      // 2. Obtener todas las tarjetas del proyecto
      const { data: cData } = await supabase
        .from('cards')
        .select('*')
        .eq('project_id', project.id)
        .order('card_number', { ascending: true })

      // 3. Generar CSV y disparar descarga
      const csvString = generateProjectCSV({
        project,
        milestones: mData || milestones,
        cards: cData || [],
      })

      const safeName = (project.repo_name || 'proyecto').replace(/[^a-zA-Z0-9_-]/g, '_')
      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `${safeName}_${project.repo_acronym || 'GRG'}_${dateStr}.csv`

      downloadCSV(filename, csvString)
    } catch (err) {
      console.error('Error exportando proyecto a CSV:', err)
      alert('Error al exportar el proyecto: ' + (err.message || err))
    } finally {
      setExporting(false)
    }
  }

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
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.provider_token || getStoredProviderToken()
      const sessionUser = session?.user || null
      if (sessionUser && !currentUser) setCurrentUser(sessionUser)

      // 1. Fetch Supabase project_members (con role)
      const { data: memberships } = await supabase
        .from('project_members')
        .select('user_id, role')
        .eq('project_id', project.id)

      const roleByUser = new Map()
      for (const m of memberships ?? []) {
        roleByUser.set(m.user_id, m.role || 'member')
      }

      // Determinar rol del usuario actual
      let currentRole = 'guest'
      if (sessionUser) {
        if (project.created_by === sessionUser.id) {
          currentRole = 'owner'
          // Si el creador no estaba en project_members en BD, asegurar su inserción como owner
          if (!roleByUser.has(sessionUser.id)) {
            supabase.from('project_members').upsert({
              project_id: project.id,
              user_id: sessionUser.id,
              added_by: sessionUser.id,
              role: 'owner',
            }, { onConflict: 'project_id, user_id' }).then(() => {})
          }
        } else if (roleByUser.has(sessionUser.id)) {
          currentRole = roleByUser.get(sessionUser.id) || 'member'
        }
      }
      setCurrentUserRole(currentRole)
      onRoleDetected?.(currentRole)

      // 2. Fetch profiles SOLO para los usuarios que son miembros activos en project_members
      // (y asegurar que el creador/owner siempre esté incluido si falta)
      const memberUserIds = new Set((memberships ?? []).map(m => m.user_id))
      if (project.created_by) memberUserIds.add(project.created_by)

      let dbProfiles = []
      if (memberUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, github_username, avatar_url')
          .in('id', Array.from(memberUserIds))
        dbProfiles = profiles ?? []
      }

      // 3. Obtener avatares de GitHub opcionalmente como enriquecimiento solo para miembros reales
      let ghCollabsMap = new Map()
      if (token && project.repo_full_name) {
        try {
          const ghCollabs = await fetchRepoCollaboratorsDetails(project.repo_full_name, token)
          for (const c of ghCollabs) {
            if (c.username) ghCollabsMap.set(c.username.toLowerCase(), c.avatar_url)
          }
        } catch (e) {
          console.warn('Could not enrich avatars from GitHub API:', e)
        }
      }

      // 4. Construir lista definitiva de miembros (única fuente de verdad: project_members)
      const map = new Map()

      for (const p of dbProfiles) {
        if (p.github_username) {
          const uname = p.github_username.toLowerCase()
          const isProjOwner = project.created_by === p.id
          const userRole = isProjOwner ? 'owner' : (roleByUser.get(p.id) || 'member')
          const avatar = p.avatar_url || ghCollabsMap.get(uname) || `https://github.com/${p.github_username}.png?size=64`

          map.set(p.id, {
            user_id: p.id,
            username: p.github_username,
            github_username: p.github_username,
            avatar_url: avatar,
            role: userRole,
          })
        }
      }

      // Si el creador/owner no estaba en profiles por alguna razón, fallback con sesión si coincide
      if (project.created_by && !map.has(project.created_by)) {
        if (sessionUser && sessionUser.id === project.created_by) {
          const uLogin = sessionUser.user_metadata?.user_name || 'owner'
          map.set(project.created_by, {
            user_id: project.created_by,
            username: uLogin,
            github_username: uLogin,
            avatar_url: sessionUser.user_metadata?.avatar_url || `https://github.com/${uLogin}.png?size=64`,
            role: 'owner',
          })
        }
      }

      setMembers(Array.from(map.values()))
    } catch (err) {
      console.warn('Error fetching project members:', err)
    }
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

  async function handleDeleteMilestone(m) {
    // 1. Calculate sequentially renumbered milestones
    const remaining = milestones
      .filter(item => item.id !== m.id)
      .sort((a, b) => a.number - b.number)

    const renumbered = remaining.map((item, idx) => ({
      ...item,
      number: idx + 1,
    }))

    // 2. Select next active milestone
    let nextActive = null
    if (activeMilestone?.id === m.id) {
      nextActive = renumbered[0] ?? null
    } else {
      nextActive = renumbered.find(item => item.id === activeMilestone?.id) ?? null
    }

    setMilestones(renumbered)
    onMilestoneChange(nextActive)

    // 3. Delete deleted milestone from DB
    await supabase.from('milestones').delete().eq('id', m.id)

    // 4. Update subsequent milestones and their cards display_ids in DB
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]
      const newNum = i + 1
      if (item.number !== newNum) {
        await supabase
          .from('milestones')
          .update({ number: newNum })
          .eq('id', item.id)

        const { data: cardsToUpdate } = await supabase
          .from('cards')
          .select('id, card_number')
          .eq('milestone_id', item.id)

        if (cardsToUpdate && cardsToUpdate.length > 0) {
          for (const card of cardsToUpdate) {
            const msPad = String(newNum).padStart(2, '0')
            const newDisplayId = `${project.repo_acronym}-${msPad}-${String(card.card_number).padStart(3, '0')}`
            await supabase
              .from('cards')
              .update({ display_id: newDisplayId })
              .eq('id', card.id)
          }
        }
      }
    }
  }

  function handleMilestoneCreated(created) {
    if (!created) return
    setMilestones(prev => {
      const exists = prev.some(m => m.id === created.id)
      const list = exists ? prev.map(m => m.id === created.id ? created : m) : [...prev, created]
      return list.sort((a, b) => a.number - b.number)
    })
    if (!activeMilestone) {
      onMilestoneChange(created)
    }
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

  async function handleKickMember() {
    if (!memberToKick?.user_id) return
    setKickError('')
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', memberToKick.user_id)

    if (error) {
      setKickError('No se pudo expulsar al colaborador: ' + error.message)
    } else {
      // Enviar notificación global al colaborador expulsado
      await createUserNotification({
        userId: memberToKick.user_id,
        projectId: project.id,
        projectName: project.repo_name,
        type: 'project_kick',
        title: `Expulsado de ${project.repo_name}`,
        message: `Has sido expulsado del proyecto "${project.repo_name}". Ya no tienes acceso a sus hitos y tarjetas.`,
        metadata: { project_name: project.repo_name },
      })

      setMembers(prev => prev.filter(m => m.user_id !== memberToKick.user_id))
      setMemberToKick(null)
    }
  }

  async function handleLeaveProject() {
    if (!currentUser) return
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', currentUser.id)

    if (!error && onDeleteProject) {
      onDeleteProject()
    }
    setShowLeaveConfirm(false)
  }

  if (loading) {
    return <div className="board-loading"><div className="loading-spinner" /></div>
  }

  return (
    <div className="project-view animate-fade-up">
      {/* Members bar: Collaborators avatars + actions */}
      <div className="members-bar">
        <div className="members-bar__left">
          <div className="members-bar__avatars" aria-label="Colaboradores del proyecto">
            {members.map(m => {
              const isSelf = m.user_id && currentUser && m.user_id === currentUser.id
              const isOwner = currentUserRole === 'owner'
              const isAdmin = currentUserRole === 'admin'
              const isTargetOwner = m.role === 'owner' || project.created_by === m.user_id
              const isTargetAdmin = m.role === 'admin'

              // Owner puede expulsar a cualquiera excepto a sí mismo
              // Admin puede expulsar a member o guest (no a owner ni a otros admin)
              const canKick =
                !isTargetOwner &&
                !isSelf &&
                m.user_id &&
                (isOwner || (isAdmin && !isTargetAdmin))

              return (
                <div key={m.username} className="member-avatar-wrap" title={isSelf ? `@${m.username} (tú)` : `@${m.username}`}>
                  <a
                    href={`https://github.com/${m.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`member-avatar-link${isSelf ? ' member-avatar-link--self' : ''}`}
                    aria-label={`@${m.username}`}
                  >
                    {m.avatar_url ? (
                      <img
                        src={m.avatar_url}
                        alt={m.username}
                        className="member-avatar"
                        loading="lazy"
                      />
                    ) : (
                      <div className="member-avatar member-avatar--placeholder">
                        {m.username?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </a>
                  {canKick && (
                    <button
                      type="button"
                      className="member-kick-btn"
                      title={`Expulsar a @${m.username}`}
                      aria-label={`Expulsar a @${m.username}`}
                      onClick={() => setMemberToKick(m)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {members.length > 0 && (
            <span className="members-bar__count">
              {members.length} {members.length === 1 ? 'colaborador' : 'colaboradores'}
            </span>
          )}

          {/* Botón Administrar colaboradores para Owner y Admin */}
          {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ marginLeft: 6, fontSize: 11.5, padding: '3px 8px', height: 26 }}
              onClick={() => setShowManageMembers(true)}
              title="Administrar colaboradores y cambiar roles"
              aria-label="Administrar colaboradores"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Administrar colaboradores
            </button>
          )}
        </div>

        <div className="members-bar__actions">
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refrescar proyecto"
            title="Refrescar proyecto, hitos y tarjetas"
          >
            <svg
              className={refreshing ? 'spin-animation' : ''}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {refreshing ? 'Refrescando...' : 'Refrescar'}
          </button>

          {/* Invitar colaborador: Solo Owner y Admin */}
          {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
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
          )}

          {/* Leave project — todos los roles excepto Owner pueden salir */}
          {currentUser && currentUserRole !== 'owner' && (
            <button
              className="btn btn--ghost btn--sm"
              style={{ color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.35)' }}
              onClick={() => setShowLeaveConfirm(true)}
              aria-label="Salir del proyecto"
              title="Salir del proyecto"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Salir
            </button>
          )}

          {/* Exportar proyecto a CSV — Solo Owner y Admin */}
          {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={handleExportProject}
              disabled={exporting}
              aria-label="Exportar proyecto a CSV"
              title="Exportar proyecto, hitos y tarjetas a un archivo .csv"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exporting ? 'Exportando...' : 'Exportar'}
            </button>
          )}

          {/* Importar proyecto desde CSV: Solo Owner y Admin */}
          {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setShowImportModal(true)}
              aria-label="Importar proyecto desde CSV"
              title="Importar hitos y tarjetas desde un archivo .csv a este proyecto"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Importar
            </button>
          )}

          {/* Editar proyecto: Solo Owner y Admin */}
          {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setShowEditProject(true)}
              aria-label="Editar proyecto"
              title="Editar proyecto"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar
            </button>
          )}

          {/* Eliminar proyecto: Exclusivo del Owner */}
          {currentUserRole === 'owner' && (
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
          )}
        </div>
      </div>

      <MilestoneBar
        project={project}
        milestones={milestones}
        activeMilestone={activeMilestone}
        currentUserRole={currentUserRole}
        onSelectMilestone={onMilestoneChange}
        onMilestoneCreated={handleMilestoneCreated}
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
          {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: 14 }}
              onClick={() => setShowCreateMilestone(true)}
            >
              <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Crear primer hito
            </button>
          )}
        </div>
      ) : activeMilestone ? (
        <Board
          project={project}
          milestone={activeMilestone}
          currentUserRole={currentUserRole}
          refreshKey={refreshKey}
        />
      ) : null}

      {showCreateMilestone && (
        <MilestoneModal
          project={project}
          nextNumber={Math.max(0, ...milestones.map(m => m.number || 0)) + 1}
          onMilestoneCreated={handleMilestoneCreated}
          onClose={() => setShowCreateMilestone(false)}
        />
      )}

      {showManageMembers && (
        <ManageMembersModal
          project={project}
          members={members}
          currentUser={currentUser}
          currentUserRole={currentUserRole}
          onMembersUpdated={async () => {
            await fetchMembers()
            setRefreshKey(prev => prev + 1)
          }}
          onClose={() => setShowManageMembers(false)}
        />
      )}

      {showInvite && (
        <InviteModal
          project={project}
          currentMembers={members}
          onClose={() => setShowInvite(false)}
        />
      )}

      {showImportModal && (
        <ImportProjectModal
          project={project}
          onImportSuccess={async () => {
            setShowImportModal(false)
            await fetchAll()
            setRefreshKey(prev => prev + 1)
          }}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showEditProject && (
        <EditProjectModal
          project={project}
          onProjectUpdated={updated => {
            onProjectUpdate?.(updated)
          }}
          onClose={() => setShowEditProject(false)}
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

      {/* Kick member confirmation */}
      {memberToKick && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMemberToKick(null)}>
          <div className="modal modal--sm" role="dialog" aria-modal="true">
            <div className="modal__header">
              <h2 className="modal__title">¿Expulsar colaborador?</h2>
              <button className="modal__close" onClick={() => setMemberToKick(null)} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal__form" style={{ padding: '0 20px 8px' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                ¿Estás seguro de que quieres expulsar a <strong>@{memberToKick.username}</strong> del proyecto?
                Perderá el acceso a todos los hitos y tarjetas.
              </p>
              {kickError && <p className="form-error" role="alert">{kickError}</p>}
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setMemberToKick(null)}>Cancelar</button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleKickMember}
              >
                Expulsar colaborador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave project confirmation */}
      {showLeaveConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowLeaveConfirm(false)}>
          <div className="modal modal--sm" role="dialog" aria-modal="true">
            <div className="modal__header">
              <h2 className="modal__title">¿Salir del proyecto?</h2>
              <button className="modal__close" onClick={() => setShowLeaveConfirm(false)} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal__form" style={{ padding: '0 20px 8px' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                ¿Estás seguro de que quieres salir de <strong>{project.repo_name}</strong>?
                Ya no podrás ver ni editar sus tarjetas ni hitos.
              </p>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={() => setShowLeaveConfirm(false)}>Cancelar</button>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.35)' }}
                onClick={handleLeaveProject}
              >
                Salir del proyecto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
