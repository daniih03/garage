import Card from './Card'

export default function Column({
  column,
  cards,
  draggingId,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDrop,
  onDragStart,
  onDragEnd,
}) {
  /* ── Drag-over visual feedback ── */
  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    e.currentTarget.classList.add('column--drag-over')
  }

  function handleDragLeave(e) {
    // Only remove class when leaving the column itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('column--drag-over')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    e.currentTarget.classList.remove('column--drag-over')
    if (draggingId) {
      onDrop(draggingId, column.id)
    }
  }

  return (
    <section
      className="column"
      aria-label={`Columna: ${column.label}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="column__header">
        <div className="column__title-group">
          <span
            className="column__dot"
            style={{ backgroundColor: column.color }}
            aria-hidden="true"
          />
          <h2 className="column__title">{column.label}</h2>
          <span className="column__count" aria-label={`${cards.length} tarjetas`}>
            {cards.length}
          </span>
        </div>

        <button
          className="column__add-btn"
          onClick={onAddCard}
          aria-label={`Añadir tarjeta a ${column.label}`}
          title="Nueva tarjeta"
        >
          {/* Plus icon */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path
              d="M7.5 2v11M2 7.5h11"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Cards */}
      <div className="column__cards" role="list">
        {cards.map(card => (
          <Card
            key={card.id}
            card={card}
            isDragging={draggingId === card.id}
            onEdit={() => onEditCard(card)}
            onDelete={() => onDeleteCard(card)}
            onDragStart={() => onDragStart(card.id)}
            onDragEnd={onDragEnd}
          />
        ))}

        {cards.length === 0 && (
          <div className="column__empty" aria-live="polite">
            Sin tarjetas
          </div>
        )}
      </div>
    </section>
  )
}
