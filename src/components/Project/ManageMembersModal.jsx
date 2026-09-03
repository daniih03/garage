import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { createUserNotification } from '../../lib/notifications'
import DangerConfirmModal from '../Common/DangerConfirmModal'

export default function ManageMembersModal({
  project,
  members,
  currentUser,
  currentUserRole,
  onMembersUpdated,
  onClose,
}) {
  const [memberToKick, setMemberToKick] = useState(null)
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [error, setError] = useState('')

  const isOwner = currentUserRole === 'owner'
  const isAdmin = currentUserRole === 'admin'

  // Opciones de roles según quién esté editando
  // Owner puede asignar: admin, member, guest
  // Admin puede asignar: member, guest (no puede crear nuevos admins)
  const assignableRolesForOwner = [
    { id: 'admin', label: 'Admin', desc: 'Gestiona hitos, tarjetas y miembros inferiores' },
    { id: 'member', label: 'Member', desc: 'Crea, edita y elimina tarjetas' },
    { id: 'guest', label: 'Guest', desc: 'Solo permisos de lectura' },
  ]

  const assignableRolesForAdmin = [
    { id: 'member', label: 'Member', desc: 'Crea, edita y elimina tarjetas' },
    { id: 'guest', label: 'Guest', desc: 'Solo permisos de lectura' },
  ]

  async function handleRoleChange(targetMember, newRole) {
    if (!targetMember.user_id || updatingUserId) return
    setError('')
    setUpdatingUserId(targetMember.user_id)

    const oldRole = targetMember.role || 'member'

    try {
      const { error: updateError } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('project_id', project.id)
        .eq('user_id', targetMember.user_id)

      if (updateError) throw updateError

      // Crear notificación para el usuario afectado
      await createUserNotification({
        userId: targetMember.user_id,
        projectId: project.id,
        projectName: project.repo_name,
        type: 'role_change',
        title: `Rol actualizado en ${project.repo_name}`,
        message: `Tu rol en el proyecto "${project.repo_name}" ha cambiado de ${oldRole.toUpperCase()} a ${newRole.toUpperCase()}.`,
        metadata: { old_role: oldRole, new_role: newRole },
      })

      onMembersUpdated?.()
    } catch (err) {
      console.error('Error al actualizar rol:', err)
      setError('No se pudo actualizar el rol: ' + (err.message || err))
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function handleConfirmKick() {
    if (!memberToKick?.user_id) return
    setError('')

    const kickedUser = memberToKick
    try {
      const { error: kickErr } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', project.id)
        .eq('user_id', kickedUser.user_id)

      if (kickErr) throw kickErr

      // Notificar al usuario expulsado en su tabla global de notificaciones
      await createUserNotification({
        userId: kickedUser.user_id,
        projectId: project.id,
        projectName: project.repo_name,
        type: 'project_kick',
        title: `Expulsado de ${project.repo_name}`,
        message: `Has sido expulsado del proyecto "${project.repo_name}". Ya no tienes acceso a sus hitos y tarjetas.`,
        metadata: { project_name: project.repo_name },
      })

      setMemberToKick(null)
      onMembersUpdated?.()
    } catch (err) {
      console.error('Error al expulsar colaborador:', err)
      setError('Error al expulsar colaborador: ' + (err.message || err))
      setMemberToKick(null)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--md" role="dialog" aria-modal="true" aria-labelledby="manage-members-title">
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--accent)' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h2 className="modal__title" id="manage-members-title">Administrar colaboradores</h2>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__scrollable" style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <p className="form-error" role="alert">{error}</p>}

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>
            Gestiona los permisos y roles de los miembros en <strong>{project.repo_name}</strong>.
            {isOwner && ' Como Owner tienes control total de asignación y expulsión.'}
            {isAdmin && ' Como Admin puedes gestionar y expulsar miembros con rol Member o Guest.'}
          </p>

          <div className="manage-members-list">
            {members.map(m => {
              const isSelf = m.user_id && currentUser && m.user_id === currentUser.id
              const targetRole = m.role || (project.created_by === m.user_id ? 'owner' : 'member')
              const isTargetOwner = targetRole === 'owner' || project.created_by === m.user_id
              const isTargetAdmin = targetRole === 'admin'

              // Reglas de edición de rol:
              // - Nadie puede cambiar el rol del Owner (es inmutable)
              // - Nadie puede cambiarse el rol a sí mismo (anti-auto-bloqueo)
              // - Owner puede cambiar a cualquier no-owner
              // - Admin solo puede cambiar a members o guests (no a otros admins ni al owner)
              const canEditRole =
                !isTargetOwner &&
                !isSelf &&
                m.user_id &&
                (isOwner || (isAdmin && !isTargetAdmin))

              // Reglas de expulsión:
              // - Nadie puede expulsar al Owner
              // - Nadie puede expulsarse a sí mismo desde aquí (se usa el botón 'Salir')
              // - Owner puede expulsar a cualquiera
              // - Admin solo puede expulsar a Member o Guest
              const canKick =
                !isTargetOwner &&
                !isSelf &&
                m.user_id &&
                (isOwner || (isAdmin && !isTargetAdmin))

              const availableRoles = isOwner ? assignableRolesForOwner : assignableRolesForAdmin

              return (
                <div key={m.username || m.user_id} className="manage-member-row">
                  <div className="manage-member-row__left">
                    <img
                      src={m.avatar_url || `https://github.com/${m.username}.png?size=64`}
                      alt={m.username}
                      className="manage-member-avatar"
                    />
                    <div className="manage-member-info">
                      <div className="manage-member-name-wrap">
                        <span className="manage-member-name">@{m.username}</span>
                        {isSelf && <span className="manage-member-self-pill">Tú</span>}
                      </div>
                      <span className={`role-badge role-badge--${targetRole}`}>
                        {targetRole.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="manage-member-row__right">
                    {canEditRole ? (
                      <select
                        className="form-select role-select"
                        value={targetRole}
                        disabled={updatingUserId === m.user_id}
                        onChange={e => handleRoleChange(m, e.target.value)}
                        aria-label={`Cambiar rol de @${m.username}`}
                      >
                        {isTargetAdmin && !isOwner && (
                          <option value="admin" disabled>Admin</option>
                        )}
                        {availableRoles.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="role-immutable-text">
                        {isTargetOwner ? 'Creador (Inmutable)' : isSelf ? 'Tu rol actual' : targetRole.toUpperCase()}
                      </span>
                    )}

                    {canKick && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm btn-kick-member"
                        onClick={() => setMemberToKick(m)}
                        title={`Expulsar a @${m.username}`}
                        aria-label={`Expulsar a @${m.username}`}
                      >
                        Expulsar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Listo
          </button>
        </div>
      </div>

      {/* Modal de confirmación reforzado para expulsar colaborador */}
      {memberToKick && (
        <DangerConfirmModal
          title="¿Expulsar colaborador del proyecto?"
          targetName={`@${memberToKick.username}`}
          targetType="colaborador"
          message={`El usuario @${memberToKick.username} será expulsado inmediatamente y perderá el acceso a todos los hitos y tarjetas de "${project.repo_name}". Recibirá una notificación en su panel.`}
          confirmText="Expulsar colaborador"
          onConfirm={handleConfirmKick}
          onClose={() => setMemberToKick(null)}
        />
      )}
    </div>,
    document.body
  )
}
