export function renderTextWithMentions(text) {
  if (!text) return null
  const parts = String(text).split(/(@[A-Z0-9]+-\d{2}-\d{3})/g)
  return parts.map((part, i) => {
    if (/^@[A-Z0-9]+-\d{2}-\d{3}$/.test(part)) {
      return (
        <span key={i} className="card-mention-badge">
          {part}
        </span>
      )
    }
    return part
  })
}

export function formatCardDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return ''
  }
}

export default function Card({
  card,
  isDragging,
  commentCount = 0,
  hasUnviewedComments = false,
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
      {/* ID + primary/secondary/priority badges + comment indicator to the right of priority */}
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

          {/* Comment icon situated to the right of priority */}
          {commentCount > 0 && (
            <span
              className={`card-comment-indicator ${hasUnviewedComments ? 'card-comment-indicator--unread' : 'card-comment-indicator--read'}`}
              title={`${commentCount} comentario${commentCount !== 1 ? 's' : ''}${hasUnviewedComments ? ' (nuevos sin leer)' : ''}`}
            >
              {hasUnviewedComments ? (
                /* Filled speech bubble (Relleno rojo: sin visualizar) */
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              ) : (
                /* Outline speech bubble (Contorno: visualizado) */
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              )}
              <span className="card-comment-count">{commentCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* Title + description */}
      <div className="card__body">
        <h3 className="card__title">{renderTextWithMentions(card.title)}</h3>
        {card.description && (
          <p className="card__description">{renderTextWithMentions(card.description)}</p>
        )}
      </div>

      {/* Footer: Fecha de creación */}
      {card.created_at && (
        <div className="card__footer">
          <span className="card__date" title={`Creada el ${new Date(card.created_at).toLocaleString('es')}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {formatCardDate(card.created_at)}
          </span>
        </div>
      )}

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
