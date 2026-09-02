import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Column from './Column'
import CardModal from './CardModal'
import ConfirmModal from '../Common/ConfirmModal'
import FilterPopover from './FilterPopover'

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

const PRIMARY_OPTIONS = [
  { id: 'all', label: 'Todos los primarios', shortLabel: 'Todos' },
  { id: 'HW',  label: 'Hardware (HW)',      shortLabel: 'HW',    color: '#F59E0B' },
  { id: 'SW',  label: 'Software (SW)',      shortLabel: 'SW',    color: '#0284C7' },
]

const SECONDARY_OPTIONS = [
  { id: 'all',   label: 'Todos los secundarios', shortLabel: 'Todos' },
  { id: 'task',  label: 'Task',                  shortLabel: 'Task',  color: '#38BDF8' },
  { id: 'bug',   label: 'Bug',                   shortLabel: 'Bug',   color: '#EF4444' },
  { id: 'spike', label: 'Spike',                 shortLabel: 'Spike', color: '#A855F7' },
  { id: 'stock', label: 'Stock',                 shortLabel: 'Stock', color: '#10B981' },
]

const PRIORITY_OPTIONS = [
  { id: 'all',      label: 'Todas las prioridades', shortLabel: 'Todas' },
  { id: 'critical', label: 'Critical',              shortLabel: 'Critical', color: '#DC2626' },
  { id: 'high',     label: 'High',                  shortLabel: 'High',     color: '#F97316' },
  { id: 'mid',      label: 'Mid',                   shortLabel: 'Mid',      color: '#0EA5E9' },
  { id: 'low',      label: 'Low',                   shortLabel: 'Low',      color: '#94A3B8' },
]

function compareCardsByPriority(a, b) {
  const weightA = PRIORITY_ORDER[a.priority?.toLowerCase()] ?? 0
  const weightB = PRIORITY_ORDER[b.priority?.toLowerCase()] ?? 0
  if (weightB !== weightA) {
    return weightB - weightA // Higher priority first
  }
  // Secondary sort by position
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
  const activeCount = (primaryFilter !== 'all' ? 1 : 0) +
                      (secondaryFilter !== 'all' ? 1 : 0) +
                      (priorityFilter !== 'all' ? 1 : 0)

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
      {/* ── Sleek Command Filter Bar ── */}
      <div className={`board-filter-bar${hasActiveFilters ? ' has-filters-active' : ''}`}>
        <div className="board-filter-bar__group">
          {/* Filter Popover: Primario */}
          <FilterPopover
            label="Primario"
            icon={(
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="15" x2="23" y2="15" />
                <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="15" x2="4" y2="15" />
              </svg>
            )}
            value={primaryFilter}
            options={PRIMARY_OPTIONS}
            onChange={setPrimaryFilter}
          />

          {/* Filter Popover: Secundario */}
          <FilterPopover
            label="Secundario"
            icon={(
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            )}
            value={secondaryFilter}
            options={SECONDARY_OPTIONS}
            onChange={setSecondaryFilter}
          />

          {/* Filter Popover: Prioridad */}
          <FilterPopover
            label="Prioridad"
            icon={(
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            )}
            value={priorityFilter}
            options={PRIORITY_OPTIONS}
            onChange={setPriorityFilter}
          />

          {/* Clear button if any filter is active */}
          {hasActiveFilters && (
            <button
              type="button"
              className="board-filter-clear-btn"
              onClick={clearFilters}
              title="Restablecer todos los filtros"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Limpiar ({activeCount})
            </button>
          )}
        </div>

        <div className="board-filter-bar__stats">
          {hasActiveFilters ? (
            <span className="filter-stats-badge">
              Mostrando <strong>{filteredCards.length}</strong> de {cards.length}
            </span>
          ) : (
            <span className="filter-stats-text">
              {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
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
