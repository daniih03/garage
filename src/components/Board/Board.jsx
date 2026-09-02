import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Column from './Column'
import CardModal from './CardModal'
import ConfirmModal from '../Common/ConfirmModal'

const COLUMNS = [
  { id: 'todo',    label: 'To do',   color: '#71717A' },
  { id: 'doing',   label: 'Doing',   color: '#38BDF8' },
  { id: 'blocked', label: 'Blocked', color: '#F43F5E' },
  { id: 'done',    label: 'Done',    color: '#10B981' },
]

const PRIORITY_ORDER = {
  critical: 4,
  high:     3,
  mid:      2,
  low:      1,
}

function compareCardsByPriority(a, b) {
  const weightA = PRIORITY_ORDER[a.priority?.toLowerCase()] ?? 0
  const weightB = PRIORITY_ORDER[b.priority?.toLowerCase()] ?? 0
  if (weightB !== weightA) {
    return weightB - weightA // Higher priority first
  }
  // Secondary sort by position or card_number
  return (a.position ?? 0) - (b.position ?? 0)
}

export default function Board({ project, milestone }) {
  const [cards,           setCards]           = useState([])
  const [loading,         setLoading]         = useState(true)
  const [modal,           setModal]           = useState({ open: false, card: null, defaultStatus: 'todo' })
  const [draggingId,      setDraggingId]      = useState(null)
  const [cardToDelete,    setCardToDelete]    = useState(null)

  /* ── Filter state ── */
  const [primaryFilter,   setPrimaryFilter]   = useState('all') // 'all' | 'HW' | 'SW'
  const [secondaryFilter, setSecondaryFilter] = useState('all') // 'all' | 'task' | 'bug' | 'spike' | 'stock'
  const [priorityFilter,  setPriorityFilter]  = useState('all') // 'all' | 'critical' | 'high' | 'mid' | 'low'

  /* ── Fetch + Realtime ── */
  useEffect(() => {
    fetchCards()

    const channel = supabase
      .channel(`board-${project.id}-${milestone.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `milestone_id=eq.${milestone.id}` },
        handleRealtimeChange
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [project.id, milestone.id])

  async function fetchCards() {
    setLoading(true)
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('project_id', project.id)
      .eq('milestone_id', milestone.id)
      .order('position', { ascending: true })

    if (!error) setCards(data ?? [])
    setLoading(false)
  }

  function handleRealtimeChange({ eventType, new: next, old: prev }) {
    setCards(current => {
      switch (eventType) {
        case 'INSERT': return [...current, next]
        case 'UPDATE': return current.map(c => c.id === next.id ? next : c)
        case 'DELETE': return current.filter(c => c.id !== prev.id)
        default: return current
      }
    })
  }

  /* ── Drag & drop ── */
  async function handleDrop(cardId, targetStatus) {
    const card = cards.find(c => c.id === cardId)
    if (!card || card.status === targetStatus) return

    // Optimistic update
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: targetStatus } : c))

    const colCards    = cards.filter(c => c.status === targetStatus)
    const newPosition = colCards.length > 0 ? Math.max(...colCards.map(c => c.position)) + 1 : 0

    const { error } = await supabase.from('cards')
      .update({ status: targetStatus, position: newPosition, updated_at: new Date().toISOString() })
      .eq('id', cardId)

    if (error) fetchCards()
  }

  /* ── Delete ── */
  async function handleDelete(cardId) {
    setCards(prev => prev.filter(c => c.id !== cardId))
    const { error } = await supabase.from('cards').delete().eq('id', cardId)
    if (error) fetchCards()
  }

  /* ── Filtering + Auto Priority Sorting ── */
  const hasActiveFilters = primaryFilter !== 'all' || secondaryFilter !== 'all' || priorityFilter !== 'all'

  function clearFilters() {
    setPrimaryFilter('all')
    setSecondaryFilter('all')
    setPriorityFilter('all')
  }

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      if (primaryFilter !== 'all' && card.primary_type !== primaryFilter) {
        return false
      }
      if (secondaryFilter !== 'all' && card.secondary_type?.toLowerCase() !== secondaryFilter) {
        return false
      }
      if (priorityFilter !== 'all' && card.priority?.toLowerCase() !== priorityFilter) {
        return false
      }
      return true
    })
  }, [cards, primaryFilter, secondaryFilter, priorityFilter])

  if (loading) {
    return (
      <div className="board-loading">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="board-wrapper">
      {/* ── Filter Bar ── */}
      <div className="board-filter-bar">
        <div className="board-filter-bar__group">
          <span className="board-filter-bar__title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filtros
          </span>

          {/* Primary filter */}
          <div className="filter-item">
            <label className="filter-item__label" htmlFor="filter-primary">Primario:</label>
            <select
              id="filter-primary"
              className={`filter-item__select${primaryFilter !== 'all' ? ' filter-item__select--active' : ''}`}
              value={primaryFilter}
              onChange={e => setPrimaryFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="HW">HW (Hardware)</option>
              <option value="SW">SW (Software)</option>
            </select>
          </div>

          {/* Secondary filter */}
          <div className="filter-item">
            <label className="filter-item__label" htmlFor="filter-secondary">Secundario:</label>
            <select
              id="filter-secondary"
              className={`filter-item__select${secondaryFilter !== 'all' ? ' filter-item__select--active' : ''}`}
              value={secondaryFilter}
              onChange={e => setSecondaryFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="spike">Spike</option>
              <option value="stock">Stock</option>
            </select>
          </div>

          {/* Priority filter */}
          <div className="filter-item">
            <label className="filter-item__label" htmlFor="filter-priority">Prioridad:</label>
            <select
              id="filter-priority"
              className={`filter-item__select${priorityFilter !== 'all' ? ' filter-item__select--active' : ''}`}
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="mid">Mid</option>
              <option value="low">Low</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn--ghost btn--xs board-filter-bar__clear"
              onClick={clearFilters}
              title="Restablecer filtros"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="board-filter-bar__stats">
          {hasActiveFilters ? (
            <span className="filter-stats-badge">
              Mostrando <strong>{filteredCards.length}</strong> de {cards.length} tarjetas
            </span>
          ) : (
            <span className="filter-stats-text">
              {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'} ordenadas por prioridad
            </span>
          )}
        </div>
      </div>

      {/* ── 4 Kanban Columns (Sorted by priority descending) ── */}
      <div className="board" role="main" aria-label={`Tablero — Hito ${milestone.number}: ${milestone.title}`}>
        {COLUMNS.map(col => {
          const colCards = filteredCards
            .filter(c => {
              if (col.id === 'doing') return c.status === 'doing' || c.status === 'inprogress'
              return c.status === col.id
            })
            .sort(compareCardsByPriority)

          return (
            <Column
              key={col.id}
              column={col}
              cards={colCards}
              draggingId={draggingId}
              onAddCard={() => setModal({ open: true, card: null, defaultStatus: col.id })}
              onEditCard={card => setModal({ open: true, card, defaultStatus: card.status })}
              onDeleteCard={card => setCardToDelete(card)}
              onDrop={handleDrop}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
            />
          )
        })}
      </div>

      {modal.open && (
        <CardModal
          card={modal.card}
          defaultStatus={modal.defaultStatus}
          project={project}
          milestone={milestone}
          cardsInStatus={cards.filter(c =>
            c.status === (modal.card?.status ?? modal.defaultStatus)
          )}
          onDeleteCard={handleDelete}
          onClose={() => setModal({ open: false, card: null, defaultStatus: 'todo' })}
        />
      )}

      {cardToDelete && (
        <ConfirmModal
          title="¿Eliminar tarjeta?"
          message={`¿Estás seguro de que quieres eliminar la tarjeta "${cardToDelete.display_id} — ${cardToDelete.title}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar tarjeta"
          danger={true}
          onConfirm={() => {
            handleDelete(cardToDelete.id)
            setCardToDelete(null)
          }}
          onClose={() => setCardToDelete(null)}
        />
      )}
    </div>
  )
}
