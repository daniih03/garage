import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import MilestoneModal from './MilestoneModal'
import DangerConfirmModal from '../Common/DangerConfirmModal'

export default function MilestoneBar({
  project,
  milestones,
  activeMilestone,
  currentUserRole,
  onSelectMilestone,
  onMilestoneCreated,
  onUpdateMilestone,
  onDeleteMilestone,
}) {
  const [showModal,         setShowModal]         = useState(false)
  const [milestoneToEdit,   setMilestoneToEdit]   = useState(null)
  const [milestoneToDelete, setMilestoneToDelete] = useState(null)

  const canManageMilestones = currentUserRole === 'owner' || currentUserRole === 'admin'
  const nextNumber = Math.max(0, ...milestones.map(m => m.number || 0)) + 1

  async function handleConfirmDelete(m) {
    if (onDeleteMilestone) {
      await onDeleteMilestone(m)
    }
  }

  return (
    <div className="milestone-bar" role="navigation" aria-label="Hitos del proyecto">
      {/* Tabs */}
      <div className="milestone-bar__tabs" role="tablist">
        {milestones.map(m => (
          <div
            key={m.id}
            className={`milestone-tab${activeMilestone?.id === m.id ? ' milestone-tab--active' : ''}`}
            onClick={() => onSelectMilestone(m)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                onSelectMilestone(m)
              }
            }}
            role="tab"
            tabIndex={0}
            aria-selected={activeMilestone?.id === m.id}
            aria-label={`Hito ${m.number}: ${m.title}`}
          >
            <span className="milestone-tab__num">#{m.number}</span>
            <span className="milestone-tab__title">{m.title}</span>

            {canManageMilestones && (
              <div className="milestone-tab__actions">
                {/* Edit button */}
                <span
                  role="button"
                  tabIndex={0}
                  className="milestone-tab__action-btn milestone-tab__edit-btn"
                  onClick={e => {
                    e.stopPropagation()
                    setMilestoneToEdit(m)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      setMilestoneToEdit(m)
                    }
                  }}
                  title={`Editar hito #${m.number} ${m.title}`}
                  aria-label={`Editar hito #${m.number} ${m.title}`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </span>

                {/* Delete button */}
                <span
                  role="button"
                  tabIndex={0}
                  className="milestone-tab__action-btn milestone-tab__delete-btn"
                  onClick={e => {
                    e.stopPropagation()
                    setMilestoneToDelete(m)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      setMilestoneToDelete(m)
                    }
                  }}
                  title={`Eliminar hito #${m.number} ${m.title}`}
                  aria-label={`Eliminar hito #${m.number} ${m.title}`}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New milestone button — Solo Owner y Admin */}
      {canManageMilestones && (
        <button
          className="btn btn--ghost btn--sm milestone-bar__add"
          onClick={() => setShowModal(true)}
          aria-label="Crear nuevo hito"
        >
          <svg width="12" height="12" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Nuevo hito
        </button>
      )}

      {/* Create modal */}
      {showModal && (
        <MilestoneModal
          project={project}
          nextNumber={nextNumber}
          onMilestoneCreated={created => {
            onMilestoneCreated?.(created)
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Edit modal */}
      {milestoneToEdit && (
        <MilestoneModal
          project={project}
          milestone={milestoneToEdit}
          onMilestoneUpdated={updated => {
            onUpdateMilestone?.(updated)
          }}
          onClose={() => setMilestoneToEdit(null)}
        />
      )}

      {/* Delete danger modal */}
      {milestoneToDelete && (
        <DangerConfirmModal
          title="¿Eliminar hito definitivamente?"
          targetName={`Hito #${milestoneToDelete.number}: ${milestoneToDelete.title}`}
          targetType="hito"
          message="Se eliminarán todas las tarjetas y tareas contenidas en este hito de forma irreversible."
          confirmText="Eliminar hito"
          onConfirm={() => handleConfirmDelete(milestoneToDelete)}
          onClose={() => setMilestoneToDelete(null)}
        />
      )}
    </div>
  )
}
