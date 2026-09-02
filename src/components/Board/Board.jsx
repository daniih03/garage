import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Column from './Column'
import CardModal from './CardModal'
import ConfirmModal from '../Common/ConfirmModal'

const COLUMNS = [
  { id: 'todo',       label: 'Por hacer',   color: '#9E9E9E' },
  { id: 'inprogress', label: 'En progreso', color: '#a51500' },
  { id: 'done',       label: 'Terminado',   color: '#27AE60' },
]

export default function Board({ project, milestone }) {
  const [cards,        setCards]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState({ open: false, card: null, defaultStatus: 'todo' })
  const [draggingId,   setDraggingId]   = useState(null)
  const [cardToDelete, setCardToDelete] = useState(null)

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
        case 'INSERT': return [...current, next].sort((a, b) => a.position - b.position)
        case 'UPDATE': return current
          .map(c => c.id === next.id ? next : c)
          .sort((a, b) => a.position - b.position)
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

    const colCards   = cards.filter(c => c.status === targetStatus)
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

  if (loading) {
    return (
      <div className="board-loading">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <>
      <div className="board" role="main" aria-label={`Tablero — Hito ${milestone.number}: ${milestone.title}`}>
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            column={col}
            cards={cards.filter(c => c.status === col.id)}
            draggingId={draggingId}
            onAddCard={() => setModal({ open: true, card: null, defaultStatus: col.id })}
            onEditCard={card => setModal({ open: true, card, defaultStatus: card.status })}
            onDeleteCard={card => setCardToDelete(card)}
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
    </>
  )
}
