import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import MilestoneModal from './MilestoneModal'
import ConfirmModal from '../Common/ConfirmModal'

export default function MilestoneBar({
  project,
  milestones,
  activeMilestone,
  onSelectMilestone,
  onDeleteMilestone,
}) {
  const [showModal,         setShowModal]         = useState(false)
  const [milestoneToDelete, setMilestoneToDelete] = useState(null)

  const nextNumber = (milestones[milestones.length - 1]?.number ?? 0) + 1

  async function handleConfirmDelete(m) {
    if (onDeleteMilestone) {
      onDeleteMilestone(m)
    }
    await supabase.from('milestones').delete().eq('id', m.id)
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
            <span
              role="button"
              tabIndex={0}
              className="milestone-tab__delete-btn"
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
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </div>
        ))}
      </div>

      {/* New milestone button */}
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

      {showModal && (
        <MilestoneModal
          project={project}
          nextNumber={nextNumber}
          onClose={() => setShowModal(false)}
        />
      )}

      {milestoneToDelete && (
        <ConfirmModal
          title="¿Eliminar hito?"
          message={`¿Estás seguro de que quieres eliminar el hito #${milestoneToDelete.number} "${milestoneToDelete.title}"? Se borrarán permanentemente todas las tarjetas contenidas en él.`}
          confirmText="Eliminar hito"
          danger={true}
          onConfirm={() => handleConfirmDelete(milestoneToDelete)}
          onClose={() => setMilestoneToDelete(null)}
        />
      )}
    </div>
  )
}
