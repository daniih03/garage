export default function Card({
  card,
  isDragging,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}) {
  function handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'move'
    requestAnimationFrame(onDragStart)
  }

  return (
    <article
      className={`card${isDragging ? ' is-dragging' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      role="listitem"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onEdit()}
      aria-label={`${card.display_id} — ${card.title}`}
    >
      {/* ID + prominent primary badge + secondary/priority badges */}
      <div className="card__meta">
        <span className="card__display-id">{card.display_id}</span>
        <div className="card__badges">
          {/* Primary tag: HW or SW (Solid, prominent) */}
          {card.primary_type && (
            <span className={`badge-primary badge-primary--${card.primary_type.toLowerCase()}`}>
              {card.primary_type}
            </span>
          )}
          {/* Secondary tag: task / bug / spike / stock (Distinct colored chips) */}
          {card.secondary_type && (
            <span className={`badge-secondary badge-secondary--${card.secondary_type}`}>
              {card.secondary_type}
            </span>
          )}
          {/* Priority tag */}
          {card.priority && (
            <span className={`badge-priority badge-priority--${card.priority}`}>
              {card.priority}
            </span>
          )}
        </div>
      </div>

      {/* Title + description */}
      <div className="card__body">
        <h3 className="card__title">{card.title}</h3>
        {card.description && (
          <p className="card__description">{card.description}</p>
        )}
      </div>

      {/* Delete (visible on hover) */}
      <div className="card__actions" onClick={e => e.stopPropagation()}>
        <button
          className="card__action-btn card__action-btn--delete"
          onClick={onDelete}
          title="Eliminar tarjeta"
          aria-label="Eliminar tarjeta"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </article>
  )
}
