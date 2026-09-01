import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Column from './Column'
import CardModal from './CardModal'

/** Column definitions — order matters for display */
const COLUMNS = [
  { id: 'todo',       label: 'Por hacer',   color: '#9E9E9E' },
  { id: 'inprogress', label: 'En progreso', color: '#D35400' },
  { id: 'done',       label: 'Terminado',   color: '#27AE60' },
]

export default function Board() {
  const [cards,      setCards]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState({ open: false, card: null, defaultStatus: 'todo' })
  const [draggingId, setDraggingId] = useState(null)

  /* ── Initial fetch + realtime subscription ── */
  useEffect(() => {
    fetchCards()

    const channel = supabase
      .channel('board-cards')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        handleRealtimeChange,
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchCards() {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('position', { ascending: true })

    if (!error) setCards(data ?? [])
    setLoading(false)
  }

  function handleRealtimeChange({ eventType, new: next, old: prev }) {
    setCards(current => {
      switch (eventType) {
        case 'INSERT':
          return [...current, next].sort((a, b) => a.position - b.position)

        case 'UPDATE':
          return current
            .map(c => (c.id === next.id ? next : c))
            .sort((a, b) => a.position - b.position)

        case 'DELETE':
          return current.filter(c => c.id !== prev.id)

        default:
          return current
      }
    })
  }

  /* ── Drag & drop ── */
  async function handleDrop(cardId, targetStatus) {
    const card = cards.find(c => c.id === cardId)
    if (!card || card.status === targetStatus) return

    // Optimistic update
    setCards(prev =>
      prev.map(c => (c.id === cardId ? { ...c, status: targetStatus } : c))
    )

    const columnCards  = cards.filter(c => c.status === targetStatus)
    const newPosition  = columnCards.length > 0
      ? Math.max(...columnCards.map(c => c.position)) + 1
      : 0

    const { error } = await supabase
      .from('cards')
      .update({ status: targetStatus, position: newPosition, updated_at: new Date().toISOString() })
      .eq('id', cardId)

    if (error) {
      console.error('Failed to move card:', error)
      fetchCards() // roll back on error
    }
  }

  /* ── Modal helpers ── */
  const openNew  = (defaultStatus) => setModal({ open: true, card: null, defaultStatus })
  const openEdit = (card)          => setModal({ open: true, card, defaultStatus: card.status })
  const closeModal = ()            => setModal({ open: false, card: null, defaultStatus: 'todo' })

  /* ── Delete ── */
  async function handleDelete(cardId) {
    // Optimistic
    setCards(prev => prev.filter(c => c.id !== cardId))
    const { error } = await supabase.from('cards').delete().eq('id', cardId)
    if (error) {
      console.error('Failed to delete card:', error)
      fetchCards()
    }
  }

  if (loading) {
    return (
      <div className="board-loading">
        <div className="loading-spinner" aria-label="Cargando tablero…" />
      </div>
    )
  }

  return (
    <>
      <div className="board" role="main" aria-label="Tablero Kanban">
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            column={col}
            cards={cards.filter(c => c.status === col.id)}
            draggingId={draggingId}
            onAddCard={() => openNew(col.id)}
            onEditCard={openEdit}
            onDeleteCard={handleDelete}
            onDrop={handleDrop}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
          />
        ))}
      </div>

      {modal.open && (
        <CardModal
          card={modal.card}
          defaultStatus={modal.defaultStatus}
          cardsInColumn={cards.filter(c => c.status === modal.defaultStatus)}
          onClose={closeModal}
        />
      )}
    </>
  )
}
