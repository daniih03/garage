import { useState } from 'react'
import MilestoneModal from './MilestoneModal'

export default function MilestoneBar({
  project,
  milestones,
  activeMilestone,
  onSelectMilestone,
}) {
  const [showModal, setShowModal] = useState(false)

  const nextNumber = (milestones[milestones.length - 1]?.number ?? 0) + 1

  return (
    <div className="milestone-bar" role="navigation" aria-label="Hitos del proyecto">
      {/* Tabs */}
      <div className="milestone-bar__tabs" role="tablist">
        {milestones.map(m => (
          <button
            key={m.id}
            className={`milestone-tab${activeMilestone?.id === m.id ? ' milestone-tab--active' : ''}`}
            onClick={() => onSelectMilestone(m)}
            role="tab"
            aria-selected={activeMilestone?.id === m.id}
            aria-label={`Hito ${m.number}: ${m.title}`}
          >
            <span className="milestone-tab__num">#{m.number}</span>
            {m.title}
          </button>
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
    </div>
  )
}
