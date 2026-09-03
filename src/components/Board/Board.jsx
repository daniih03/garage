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

const PRIMARY_OPTIONS = [
  { id: 'HW', label: 'HW', title: 'Hardware', color: '#F59E0B' },
  { id: 'SW', label: 'SW', title: 'Software', color: '#0284C7' },
]

const SECONDARY_OPTIONS = [
  { id: 'task',  label: 'Task',  color: '#38BDF8' },
  { id: 'bug',   label: 'Bug',   color: '#EF4444' },
  { id: 'spike', label: 'Spike', color: '#A855F7' },
  { id: 'stock', label: 'Stock', color: '#10B981' },
]

const PRIORITY_OPTIONS = [
  { id: 'critical', label: 'Critical', color: '#DC2626' },
  { id: 'high',     label: 'High',     color: '#F97316' },
  { id: 'mid',      label: 'Mid',      color: '#0EA5E9' },
  { id: 'low',      label: 'Low',      color: '#94A3B8' },
]

function compareCardsByPriority(a, b) {
  const weightA = PRIORITY_ORDER[a.priority?.toLowerCase()] ?? 0
  const weightB = PRIORITY_ORDER[b.priority?.toLowerCase()] ?? 0
  if (weightB !== weightA) {
    return weightB - weightA // Higher priority first
  }
  return (a.position ?? 0) - (b.position ?? 0)
}

export default function Board({ project, milestone, refreshKey }) {
  const [cards,           setCards]           = useState([])
  const [allProjectCards, setAllProjectCards] = useState([])
  const [loading,         setLoading]         = useState(true)
  const [modal,           setModal]           = useState({ open: false, card: null, defaultStatus: '' })
  const [draggingId,      setDraggingId]      = useState(null)
  const [cardToDelete,    setCardToDelete]    = useState(null)
  const [currentUser,     setCurrentUser]     = useState(null)
  const [commentsMeta,    setCommentsMeta]    = useState({})
  const [viewedMap,       setViewedMap]       = useState({})

  /* ── Filter state ── */
  // Single select (or null): 'HW' | 'SW' | null
  const [primaryFilter,    setPrimaryFilter]    = useState(null)
  // Multi-select (or empty): ['task', 'bug', ...]
  const [secondaryFilters, setSecondaryFilters] = useState([])
  // Multi-select (or empty): ['critical', 'high', ...]
  const [priorityFilters,  setPriorityFilters]  = useState([])

  /* ── User & viewed map setup ── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user)
      if (user) {
        try {
          const stored = JSON.parse(localStorage.getItem(`garage_viewed_comments_${user.id}`) || '{}')
          setViewedMap(stored)
        } catch {}
      }
    })
  }, [])

  /* ── Fetch + Realtime ── */
  useEffect(() => {
    fetchCards()
    fetchAllProjectCards()

    const channel = supabase
      .channel(`board-${project.id}-${milestone.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `milestone_id=eq.${milestone.id}` },
        handleRealtimeChange
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'card_comments' },
        () => fetchCards()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [project.id, milestone.id, refreshKey])

  async function fetchAllProjectCards() {
    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('project_id', project.id)
      .order('card_number', { ascending: true })
    if (data) setAllProjectCards(data)
  }

  async function fetchCards() {
    setLoading(true)

    // Retrieve active user directly to prevent any async initialization race conditions
    const { data: authData } = await supabase.auth.getUser()
    const activeUser = authData?.user || currentUser
    if (authData?.user && !currentUser) {
      setCurrentUser(authData.user)
    }

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('project_id', project.id)
      .eq('milestone_id', milestone.id)
      .order('position', { ascending: true })

    if (!error && data) {
      // Auto-migrate legacy 1-digit milestone IDs (e.g. GRGTL-1-001 -> GRGTL-01-001)
      const normalized = data.map(card => {
        if (card.display_id && /^([A-Z0-9]+)-(\d{1})-(\d{3})$/.test(card.display_id)) {
          const updatedId = card.display_id.replace(/^([A-Z0-9]+)-(\d{1})-(\d{3})$/, '$1-0$2-$3')
          supabase.from('cards').update({ display_id: updatedId }).eq('id', card.id).then()
          return { ...card, display_id: updatedId }
        }
        return card
      })

      // Deduplicate cards to prevent any duplicate keys or items
      const uniqueCards = []
      const seenIds = new Set()
      for (const c of normalized) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id)
          uniqueCards.push(c)
        }
      }
      setCards(uniqueCards)

      // Fetch comments metadata for cards
      const cardIds = uniqueCards.map(c => c.id)
      if (cardIds.length > 0) {
        const { data: comments } = await supabase
          .from('card_comments')
          .select('card_id, created_at, created_by')
          .in('card_id', cardIds)

        const meta = {}
        for (const c of comments ?? []) {
          if (!meta[c.card_id]) {
            meta[c.card_id] = { count: 0, latestAt: c.created_at, latestOtherCommentAt: null }
          }
          meta[c.card_id].count++
          if (new Date(c.created_at) > new Date(meta[c.card_id].latestAt)) {
            meta[c.card_id].latestAt = c.created_at
          }
          // Only track as other's comment if created by someone other than the current user
          if (activeUser?.id && c.created_by !== activeUser.id) {
            if (!meta[c.card_id].latestOtherCommentAt || new Date(c.created_at) > new Date(meta[c.card_id].latestOtherCommentAt)) {
              meta[c.card_id].latestOtherCommentAt = c.created_at
            }
          }
        }
        setCommentsMeta(meta)
      }
    }
    setLoading(false)
  }

  function handleRealtimeChange({ eventType, new: next, old: prev }) {
    setCards(current => {
      switch (eventType) {
        case 'INSERT': {
          if (!next || current.some(c => c.id === next.id)) return current
          return [...current, next]
        }
        case 'UPDATE': {
          if (!next) return current
          return current.map(c => c.id === next.id ? next : c)
        }
        case 'DELETE': {
          if (!prev) return current
          return current.filter(c => c.id !== prev.id)
        }
        default: return current
      }
    })
  }

  function handleMarkCardViewed(cardId) {
    if (!cardId) return
    const now = new Date().toISOString()
    setViewedMap(prev => {
      const next = { ...prev, [cardId]: now }
      if (currentUser) {
        try {
          localStorage.setItem(`garage_viewed_comments_${currentUser.id}`, JSON.stringify(next))
        } catch {}
      }
      return next
    })
  }

  function handleOpenCard(card, defaultStatus = '') {
    if (card?.id) {
      handleMarkCardViewed(card.id)
    }
    setModal({ open: true, card, defaultStatus: card?.status ?? defaultStatus })
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

  /* ── Toggle Filters ── */
  function togglePrimary(id) {
    // Single select or none: toggle off if already selected
    setPrimaryFilter(prev => prev === id ? null : id)
  }

  function toggleSecondary(id) {
    // Multi select: toggle in/out of array
    setSecondaryFilters(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  function togglePriority(id) {
    // Multi select: toggle in/out of array
    setPriorityFilters(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  function clearAllFilters() {
    setPrimaryFilter(null)
    setSecondaryFilters([])
    setPriorityFilters([])
  }

  const hasActiveFilters = Boolean(
    primaryFilter !== null ||
    secondaryFilters.length > 0 ||
    priorityFilters.length > 0
  )

  const activeCount =
    (primaryFilter !== null ? 1 : 0) +
    secondaryFilters.length +
    priorityFilters.length

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // Primary filter (single-select or all)
      if (primaryFilter !== null && card.primary_type !== primaryFilter) {
        return false
      }
      // Secondary filter (multi-select: match ANY of selected, or all if empty)
      if (secondaryFilters.length > 0) {
        const cSec = card.secondary_type?.toLowerCase()
        if (!secondaryFilters.includes(cSec)) {
          return false
        }
      }
      // Priority filter (multi-select: match ANY of selected, or all if empty)
      if (priorityFilters.length > 0) {
        const cPrio = card.priority?.toLowerCase()
        if (!priorityFilters.includes(cPrio)) {
          return false
        }
      }
      return true
    })
  }, [cards, primaryFilter, secondaryFilters, priorityFilters])

  if (loading) {
    return (
      <div className="board-loading">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="board-wrapper">
      {/* ── Visual Inline Filter Bar ── */}
      <div className={`board-filter-bar${hasActiveFilters ? ' has-filters-active' : ''}`}>
        <div className="board-filter-bar__group">
          {/* Section 1: Primario (Single select) */}
          <div className="filter-pill-section">
            <span className="filter-pill-section__label">Primario</span>
            <div className="filter-pill-section__pills" role="group" aria-label="Filtro primario">
              {PRIMARY_OPTIONS.map(opt => {
                const isSelected = primaryFilter === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.title}
                    className={`visual-filter-pill visual-filter-pill--${opt.id.toLowerCase()}${isSelected ? ' is-active' : ''}`}
                    style={isSelected ? { '--pill-color': opt.color } : {}}
                    onClick={() => togglePrimary(opt.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="visual-filter-pill__dot" style={{ backgroundColor: opt.color }} aria-hidden="true" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="filter-section-divider" aria-hidden="true" />

          {/* Section 2: Secundario (Multi-select) */}
          <div className="filter-pill-section">
            <span className="filter-pill-section__label">Secundario</span>
            <div className="filter-pill-section__pills" role="group" aria-label="Filtro secundario">
              {SECONDARY_OPTIONS.map(opt => {
                const isSelected = secondaryFilters.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`visual-filter-pill visual-filter-pill--${opt.id}${isSelected ? ' is-active' : ''}`}
                    style={isSelected ? { '--pill-color': opt.color } : {}}
                    onClick={() => toggleSecondary(opt.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="visual-filter-pill__dot" style={{ backgroundColor: opt.color }} aria-hidden="true" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="filter-section-divider" aria-hidden="true" />

          {/* Section 3: Prioridad (Multi-select) */}
          <div className="filter-pill-section">
            <span className="filter-pill-section__label">Prioridad</span>
            <div className="filter-pill-section__pills" role="group" aria-label="Filtro de prioridad">
              {PRIORITY_OPTIONS.map(opt => {
                const isSelected = priorityFilters.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`visual-filter-pill visual-filter-pill--${opt.id}${isSelected ? ' is-active' : ''}`}
                    style={isSelected ? { '--pill-color': opt.color } : {}}
                    onClick={() => togglePriority(opt.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="visual-filter-pill__dot" style={{ backgroundColor: opt.color }} aria-hidden="true" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Clear all button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="board-filter-clear-btn"
              onClick={clearAllFilters}
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
              {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'} ordenadas por prioridad
            </span>
          )}

          <button
            type="button"
            className="board-create-btn"
            onClick={() => handleOpenCard(null, '')}
            title="Nueva tarjeta"
          >
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Nueva tarjeta
          </button>
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
            .map(c => {
              const meta = commentsMeta[c.id]
              const count = meta?.count ?? 0
              const lastViewedAt = viewedMap[c.id]
              let hasUnviewed = false
              if (count > 0) {
                if (!lastViewedAt) {
                  hasUnviewed = currentUser ? Boolean(meta?.latestOtherCommentAt) : true
                } else {
                  hasUnviewed = Boolean(meta?.latestOtherCommentAt && new Date(meta.latestOtherCommentAt) > new Date(lastViewedAt))
                }
              }
              return {
                ...c,
                commentCount: count,
                hasUnviewedComments: hasUnviewed,
              }
            })

          return (
            <Column
              key={col.id}
              column={col}
              cards={colCards}
              draggingId={draggingId}
              onEditCard={card => handleOpenCard(card, card.status)}
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
          milestoneCards={cards}
          cardsInStatus={cards.filter(c =>
            c.status === (modal.card?.status ?? modal.defaultStatus)
          )}
          allCards={allProjectCards}
          onCardViewed={handleMarkCardViewed}
          onDeleteCard={handleDelete}
          onClose={() => {
            if (modal.card?.id) {
              handleMarkCardViewed(modal.card.id)
            }
            setModal({ open: false, card: null, defaultStatus: '' })
            fetchCards()
          }}
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
