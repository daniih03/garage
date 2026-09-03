import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../Common/ConfirmModal'
import { renderTextWithMentions } from './Card'

const STATUSES = [
  { id: 'todo',    label: 'To do',   color: '#71717A' },
  { id: 'doing',   label: 'Doing',   color: '#38BDF8' },
  { id: 'blocked', label: 'Blocked', color: '#F43F5E' },
  { id: 'done',    label: 'Done',    color: '#10B981' },
]

const PRIMARY_TYPES = [
  { id: 'HW', label: 'HW', title: 'Hardware', color: '#F59E0B' },
  { id: 'SW', label: 'SW', title: 'Software', color: '#0284C7' },
]

const SECONDARY_TYPES = [
  { id: 'task',  label: 'Task',  color: '#38BDF8' },
  { id: 'bug',   label: 'Bug',   color: '#EF4444' },
  { id: 'spike', label: 'Spike', color: '#A855F7' },
  { id: 'stock', label: 'Stock', color: '#10B981' },
]

const PRIORITIES = [
  { id: 'low',      label: 'Low',      color: '#94A3B8' },
  { id: 'mid',      label: 'Mid',      color: '#0EA5E9' },
  { id: 'high',     label: 'High',     color: '#F97316' },
  { id: 'critical', label: 'Critical', color: '#DC2626' },
]

export default function CardModal({
  card,
  defaultStatus,
  project,
  milestone,
  cardsInStatus,
  milestoneCards = [],
  allCards = [],
  onCardViewed,
  onDeleteCard,
  onClose,
}) {
  const isEditing = Boolean(card)

  const initialStatus = (card?.status === 'inprogress' ? 'doing' : card?.status)
    ?? (defaultStatus === 'inprogress' ? 'doing' : defaultStatus)

  /* ── Form state ── */
  const [form, setForm] = useState({
    title:          card?.title          ?? '',
    description:    card?.description    ?? '',
    status:         initialStatus,
    primary_type:   card?.primary_type   ?? '',
    secondary_type: card?.secondary_type ?? '',
    priority:       card?.priority       ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  /* ── Mention autocomplete state ── */
  const [mentionMenu, setMentionMenu] = useState({
    open: false,
    field: null, // 'title' | 'description'
    query: '',
    cursorPos: 0,
    selectedIndex: 0,
  })

  /* ── Dedicated Milestone Card Picker state ── */
  const [showPickerModal, setShowPickerModal] = useState(false)
  const [pickerSearch,    setPickerSearch]    = useState('')

  /* ── Comparison panel state ── */
  const [showComparison,    setShowComparison]    = useState(true)
  const [activeRefCardId,   setActiveRefCardId]   = useState(null)

  /* ── Comments state ── */
  const [comments,     setComments]     = useState([])
  const [newComment,   setNewComment]   = useState('')
  const [addingComment,setAddingComment]= useState(false)
  const [currentUser,  setCurrentUser]  = useState(null)

  const titleRef = useRef(null)
  const descRef  = useRef(null)

  /* ── All available cards in THIS milestone (excluding self) ── */
  const availableMilestoneCards = useMemo(() => {
    const list = milestoneCards.length > 0
      ? milestoneCards
      : allCards.filter(c => c.milestone_id === milestone.id)
    return list.filter(c => c.id !== card?.id)
  }, [milestoneCards, allCards, milestone.id, card?.id])

  /* ── Parse referenced cards from title & description ── */
  const referencedCards = useMemo(() => {
    const text = `${form.title} ${form.description}`
    const matches = Array.from(text.matchAll(/@([A-Z0-9]+-\d{2}-\d{3})/g)).map(m => m[1])
    const uniqueIds = Array.from(new Set(matches))
    return uniqueIds
      .map(id => allCards.find(c => c.display_id === id) || availableMilestoneCards.find(c => c.display_id === id))
      .filter(Boolean)
      .filter(c => c.id !== card?.id)
  }, [form.title, form.description, allCards, availableMilestoneCards, card?.id])

  // Sync activeRefCardId when referencedCards change
  useEffect(() => {
    if (referencedCards.length > 0) {
      if (!activeRefCardId || !referencedCards.some(c => c.id === activeRefCardId)) {
        setActiveRefCardId(referencedCards[0].id)
      }
    } else {
      setActiveRefCardId(null)
    }
  }, [referencedCards, activeRefCardId])

  const activeComparisonCard = referencedCards.find(c => c.id === activeRefCardId) || referencedCards[0]
  const activeRefIndex = referencedCards.findIndex(c => c.id === activeComparisonCard?.id)

  /* ── Filter candidates for @ mention autocomplete (only from milestone) ── */
  const mentionCandidates = useMemo(() => {
    if (!mentionMenu.open) return []
    const q = mentionMenu.query.toLowerCase()
    return availableMilestoneCards
      .filter(c => {
        if (!q) return true
        return (
          c.display_id?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }, [mentionMenu.open, mentionMenu.query, availableMilestoneCards])

  /* ── Filter cards for dedicated picker ── */
  const filteredPickerCards = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return availableMilestoneCards
    return availableMilestoneCards.filter(c =>
      c.display_id?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q)
    )
  }, [pickerSearch, availableMilestoneCards])

  /* ── Mount effects ── */
  useEffect(() => {
    titleRef.current?.focus()
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))

    const onKey = e => {
      if (e.key === 'Escape') {
        if (mentionMenu.open) {
          setMentionMenu(prev => ({ ...prev, open: false }))
        } else if (showPickerModal) {
          setShowPickerModal(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, mentionMenu.open, showPickerModal])

  /* ── Comments: Fetch + Realtime ── */
  useEffect(() => {
    if (!isEditing || !card?.id) return

    fetchComments()

    const channel = supabase
      .channel(`comments-${card.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'card_comments', filter: `card_id=eq.${card.id}` },
        handleCommentChange
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [card?.id, isEditing])

  async function fetchComments() {
    const { data } = await supabase
      .from('card_comments')
      .select('*')
      .eq('card_id', card.id)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  function handleCommentChange({ eventType, new: next, old: prev }) {
    setComments(current => {
      switch (eventType) {
        case 'INSERT': return [...current, next]
        case 'DELETE': return current.filter(c => c.id !== prev.id)
        default: return current
      }
    })
  }

  /* ── Comment actions ── */
  async function handleAddComment() {
    const text = newComment.trim()
    if (!text || !currentUser) return
    setAddingComment(true)

    const { error: dbError } = await supabase.from('card_comments').insert({
      card_id:    card.id,
      content:    text,
      created_by: currentUser.id,
    })

    if (!dbError) {
      setNewComment('')
      onCardViewed?.(card.id)
    }
    setAddingComment(false)
  }

  async function handleDeleteComment(commentId) {
    setComments(prev => prev.filter(c => c.id !== commentId))
    await supabase.from('card_comments').delete().eq('id', commentId)
  }

  /* ── Form & Mention Handlers ── */
  function handleInputChange(e) {
    const { name, value, selectionStart } = e.target
    setForm(prev => ({ ...prev, [name]: value }))

    // Detect @ trigger
    const textBeforeCursor = value.slice(0, selectionStart ?? value.length)
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/)

    if (match) {
      setMentionMenu({
        open: true,
        field: name,
        query: match[1],
        cursorPos: selectionStart ?? value.length,
        selectedIndex: 0,
      })
    } else {
      if (mentionMenu.open) {
        setMentionMenu(prev => ({ ...prev, open: false }))
      }
    }
  }

  function handleInputKeyDown(e) {
    if (!mentionMenu.open || mentionCandidates.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionMenu(prev => ({
        ...prev,
        selectedIndex: (prev.selectedIndex + 1) % mentionCandidates.length,
      }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionMenu(prev => ({
        ...prev,
        selectedIndex: (prev.selectedIndex - 1 + mentionCandidates.length) % mentionCandidates.length,
      }))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const selected = mentionCandidates[mentionMenu.selectedIndex]
      if (selected) selectMention(selected)
    }
  }

  function selectMention(targetCard) {
    const field = mentionMenu.field || 'description'
    const currentVal = form[field]
    const textBefore = currentVal.slice(0, mentionMenu.cursorPos)
    const textAfter  = currentVal.slice(mentionMenu.cursorPos)

    const updatedBefore = textBefore.replace(/@([a-zA-Z0-9_-]*)$/, `@${targetCard.display_id} `)
    const newText = updatedBefore + textAfter

    setForm(prev => ({ ...prev, [field]: newText }))
    setMentionMenu({ open: false, field: null, query: '', cursorPos: 0, selectedIndex: 0 })
    setActiveRefCardId(targetCard.id)
    setShowComparison(true)

    if (field === 'title') {
      titleRef.current?.focus()
    } else {
      descRef.current?.focus()
    }
  }

  function insertReferenceFromPicker(targetCard) {
    const currentDesc = form.description
    const separator = currentDesc.length > 0 && !currentDesc.endsWith(' ') && !currentDesc.endsWith('\n') ? ' ' : ''
    const newDesc = `${currentDesc}${separator}@${targetCard.display_id} `

    setForm(prev => ({ ...prev, description: newDesc }))
    setActiveRefCardId(targetCard.id)
    setShowComparison(true)
    setShowPickerModal(false)

    setTimeout(() => {
      descRef.current?.focus()
    }, 50)
  }

  function togglePill(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: prev[field] === value ? '' : value,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) {
      setError('El título es obligatorio.')
      titleRef.current?.focus()
      return
    }
    if (!form.primary_type) {
      setError('El campo Primario (HW o SW) es obligatorio.')
      return
    }
    if (!form.secondary_type) {
      setError('El campo Secundario (Task, Bug, Spike o Stock) es obligatorio.')
      return
    }
    if (!form.priority) {
      setError('El campo Prioridad (Low, Mid, High o Critical) es obligatorio.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      title,
      description:    form.description.trim()    || null,
      status:         form.status,
      primary_type:   form.primary_type,
      secondary_type: form.secondary_type,
      priority:       form.priority,
      updated_at:     new Date().toISOString(),
    }

    let dbError = null

    if (isEditing) {
      ;({ error: dbError } = await supabase
        .from('cards')
        .update(payload)
        .eq('id', card.id))
    } else {
      const { data: maxData } = await supabase
        .from('cards')
        .select('card_number')
        .eq('project_id',  project.id)
        .eq('milestone_id', milestone.id)
        .order('card_number', { ascending: false })
        .limit(1)

      const nextNum  = (maxData?.[0]?.card_number ?? 0) + 1
      const msNum = String(milestone.number).padStart(2, '0')
      const displayId = `${project.repo_acronym}-${msNum}-${String(nextNum).padStart(3, '0')}`

      const position = cardsInStatus.length > 0
        ? Math.max(...cardsInStatus.map(c => c.position)) + 1
        : 0

      ;({ error: dbError } = await supabase.from('cards').insert({
        ...payload,
        project_id:   project.id,
        milestone_id: milestone.id,
        card_number:  nextNum,
        display_id:   displayId,
        position,
        created_by:   currentUser?.id ?? null,
      }))
    }

    setSaving(false)
    if (dbError) setError(dbError.message)
    else onClose()
  }

  function formatDate(iso) {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  }

  const hasParallelView = Boolean(activeComparisonCard && showComparison)

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal ${hasParallelView ? 'modal--parallel' : 'modal--lg'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
      >
        {/* ── COLUMN 1: Form Column ── */}
        <div className="card-modal__form-col">
          <form className="modal__form-wrapper" onSubmit={handleSubmit} noValidate>
            {/* 1. Header */}
            <div className="modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isEditing && (
                  <span className="display-id-badge" aria-label={`ID: ${card.display_id}`}>
                    {card.display_id}
                  </span>
                )}
                <h2 className="modal__title" id="card-modal-title">
                  {isEditing ? 'Editar tarjeta' : 'Nueva tarjeta'}
                </h2>
              </div>
              <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Banner when references exist but comparison is minimized */}
            {referencedCards.length > 0 && !showComparison && (
              <div className="card-ref-minimized-banner">
                <span>
                  Vinculada con <strong>@{referencedCards[0].display_id}</strong>
                  {referencedCards.length > 1 && ` (+${referencedCards.length - 1} más)`}
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() => setShowComparison(true)}
                >
                  Comparar en paralelo ↔
                </button>
              </div>
            )}

            {/* 2. Scrollable Middle Content */}
            <div className="card-modal__content">
              {error && <p className="form-error" role="alert">{error}</p>}

              {/* Title with @ mention support */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label" htmlFor="c-title">
                  Título <span className="required" aria-hidden="true">*</span>
                  <span className="form-label__hint">Escribe @ para vincular tarjetas del hito</span>
                </label>
                <input
                  ref={titleRef}
                  id="c-title"
                  name="title"
                  type="text"
                  className="form-input"
                  value={form.title}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Resumen claro de la tarea…"
                  required
                />

                {/* Mention Dropdown for Title */}
                {mentionMenu.open && mentionMenu.field === 'title' && mentionCandidates.length > 0 && (
                  <div className="mention-dropdown">
                    <div className="mention-dropdown__header">Tarjetas del hito:</div>
                    {mentionCandidates.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`mention-item${idx === mentionMenu.selectedIndex ? ' mention-item--selected' : ''}`}
                        onClick={() => selectMention(c)}
                      >
                        <span className="mention-item__id">{c.display_id}</span>
                        <span className="mention-item__title">{c.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Intuitive Milestone Reference Helper Button */}
              <div className="card-reference-helper">
                <button
                  type="button"
                  className={`btn-link-card-helper${showPickerModal ? ' btn-link-card-helper--active' : ''}`}
                  onClick={() => setShowPickerModal(prev => !prev)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {showPickerModal ? 'Ocultar selector de tarjetas' : `+ Vincular tarjeta del hito (${availableMilestoneCards.length} disponibles)`}
                </button>
              </div>

              {/* Dedicated Card Picker Panel */}
              {showPickerModal && (
                <div className="card-picker-panel animate-fade-in">
                  <div className="card-picker-panel__header">
                    <span className="card-picker-panel__title">Elige una tarjeta de este hito para vincular:</span>
                    <input
                      type="text"
                      className="form-input form-input--xs"
                      placeholder="Buscar por título o ID…"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="card-picker-panel__list">
                    {filteredPickerCards.length === 0 ? (
                      <p className="card-picker-empty">
                        {availableMilestoneCards.length === 0
                          ? 'No hay otras tarjetas creadas en este hito todavía.'
                          : 'No se encontraron tarjetas que coincidan con la búsqueda.'}
                      </p>
                    ) : (
                      filteredPickerCards.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="card-picker-item"
                          onClick={() => insertReferenceFromPicker(c)}
                        >
                          <div className="card-picker-item__meta">
                            <span className="card-picker-item__id">{c.display_id}</span>
                            <span className={`status-badge status-badge--${c.status}`}>
                              {STATUSES.find(s => s.id === c.status)?.label ?? c.status}
                            </span>
                            {c.primary_type && (
                              <span className={`badge-primary badge-primary--${c.primary_type.toLowerCase()}`}>
                                {c.primary_type}
                              </span>
                            )}
                          </div>
                          <span className="card-picker-item__title">{c.title}</span>
                          <span className="card-picker-item__action">+ Vincular</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Description with @ mention support */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label" htmlFor="c-desc">
                  Descripción
                  <span className="form-label__hint">Escribe @ para autocompletar</span>
                </label>
                <textarea
                  ref={descRef}
                  id="c-desc"
                  name="description"
                  className="form-textarea"
                  value={form.description}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Detalles, contexto, objetivos… (escribe @ para comparar en paralelo)"
                  rows={3}
                />

                {/* Mention Dropdown for Description */}
                {mentionMenu.open && mentionMenu.field === 'description' && mentionCandidates.length > 0 && (
                  <div className="mention-dropdown">
                    <div className="mention-dropdown__header">Tarjetas del hito:</div>
                    {mentionCandidates.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`mention-item${idx === mentionMenu.selectedIndex ? ' mention-item--selected' : ''}`}
                        onClick={() => selectMention(c)}
                      >
                        <span className="mention-item__id">{c.display_id}</span>
                        <span className="mention-item__title">{c.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Primary (HW / SW) + Secondary side by side */}
              <div className="form-row">
                <div className="form-group">
                  <span className="form-label" id="primary-label">
                    Primario (HW / SW) <span className="required" aria-hidden="true">*</span>
                  </span>
                  <div className="pill-group" role="group" aria-labelledby="primary-label">
                    {PRIMARY_TYPES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        title={t.title}
                        className={`pill pill--primary-${t.id.toLowerCase()}${form.primary_type === t.id
                          ? ' pill--active'
                          : ''}`}
                        onClick={() => togglePill('primary_type', t.id)}
                        aria-pressed={form.primary_type === t.id}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <span className="form-label" id="secondary-label">
                    Secundario <span className="required" aria-hidden="true">*</span>
                  </span>
                  <div className="pill-group" role="group" aria-labelledby="secondary-label">
                    {SECONDARY_TYPES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className={`pill pill--secondary-${t.id}${form.secondary_type === t.id ? ' pill--active' : ''}`}
                        onClick={() => togglePill('secondary_type', t.id)}
                        aria-pressed={form.secondary_type === t.id}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div className="form-group">
                <span className="form-label" id="priority-label">
                  Prioridad <span className="required" aria-hidden="true">*</span>
                </span>
                <div className="pill-group" role="group" aria-labelledby="priority-label">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`pill pill--priority-${p.id}${form.priority === p.id ? ' pill--active' : ''}`}
                      style={form.priority === p.id ? { '--pill-active-color': p.color } : {}}
                      onClick={() => togglePill('priority', p.id)}
                      aria-pressed={form.priority === p.id}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="form-group">
                <span className="form-label" id="status-label">Estado</span>
                <div className="status-selector" role="radiogroup" aria-labelledby="status-label">
                  {STATUSES.map(s => (
                    <label
                      key={s.id}
                      className={`status-option${form.status === s.id ? ' status-option--active' : ''}`}
                      style={form.status === s.id ? { borderColor: s.color, color: s.color } : {}}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={s.id}
                        checked={form.status === s.id}
                        onChange={handleInputChange}
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                        aria-label={s.label}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Comments (edit mode only) */}
              {isEditing && (
                <div className="comments-section">
                  <h3 className="comments-section__title">
                    Comentarios
                    {comments.length > 0 && (
                      <span className="comments-count">{comments.length}</span>
                    )}
                  </h3>

                  {comments.length === 0 ? (
                    <p className="comments-empty">Sin comentarios todavía.</p>
                  ) : (
                    <div className="comments-list">
                      {comments.map(c => (
                        <div key={c.id} className="comment">
                          <div className="comment__header">
                            <span className="comment__author">
                              {c.created_by === currentUser?.id ? 'Tú' : 'Colaborador'}
                            </span>
                            <span className="comment__date">{formatDate(c.created_at)}</span>
                            {c.created_by === currentUser?.id && (
                              <button
                                type="button"
                                className="comment__delete"
                                onClick={() => handleDeleteComment(c.id)}
                                aria-label="Eliminar comentario"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <p className="comment__content">{c.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="comment-input-group">
                    <textarea
                      className="form-textarea"
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Añade un comentario…"
                      rows={2}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment()
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addingComment}
                    >
                      {addingComment ? '…' : 'Comentar'}
                    </button>
                  </div>
                  <p className="comment-hint">Ctrl+Enter para enviar</p>
                </div>
              )}
            </div>

            {/* 3. Fixed Footer */}
            <div className="modal__footer">
              {isEditing && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{
                    color: 'var(--danger)',
                    borderColor: 'rgba(231,76,60,0.3)',
                    marginRight: 'auto',
                  }}
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label="Eliminar tarjeta"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 4 }}>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  Eliminar tarjeta
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Guardando…' : isEditing ? 'Actualizar' : 'Crear tarjeta'}
              </button>
            </div>
          </form>
        </div>

        {/* ── COLUMN 2: Parallel Comparison Column (Active when @mention is present) ── */}
        {hasParallelView && (
          <div className="card-comparison-col">
            {/* Header with collapse button */}
            <div className="card-comparison-header">
              <div className="card-comparison-header__info">
                <span className="card-comparison-header__title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 6 }}>
                    <path d="M16 3h5v5" />
                    <path d="M8 21H3v-5" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </svg>
                  Comparativa en paralelo
                </span>
              </div>

              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={() => setShowComparison(false)}
                title="Ocultar vista paralela"
                aria-label="Ocultar comparativa"
              >
                Ocultar
              </button>
            </div>

            {/* Direct-Click Switcher for Multiple Referenced Cards */}
            {referencedCards.length > 1 && (
              <div className="card-comparison-switcher">
                <div className="card-comparison-switcher__top">
                  <span className="card-comparison-switcher__counter">
                    Tarjetas vinculadas ({referencedCards.length}) — pulsa para comparar:
                  </span>
                </div>

                <div className="card-comparison-switcher__pills">
                  {referencedCards.map(rc => {
                    const isActive = rc.id === activeComparisonCard.id
                    return (
                      <button
                        key={rc.id}
                        type="button"
                        className={`card-switcher-item${isActive ? ' card-switcher-item--active' : ''}`}
                        onClick={() => setActiveRefCardId(rc.id)}
                        title={rc.title}
                      >
                        <span className="card-switcher-item__id">@{rc.display_id}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Comparison card body */}
            <div className="card-comparison-body">
              <div className="comparison-card-meta">
                <span className="card__display-id">{activeComparisonCard.display_id}</span>
                <span className={`status-badge status-badge--${activeComparisonCard.status}`}>
                  {STATUSES.find(s => s.id === activeComparisonCard.status)?.label ?? activeComparisonCard.status}
                </span>

                <div className="card__badges" style={{ marginLeft: 'auto' }}>
                  {activeComparisonCard.primary_type && (
                    <span className={`badge-primary badge-primary--${activeComparisonCard.primary_type.toLowerCase()}`}>
                      {activeComparisonCard.primary_type}
                    </span>
                  )}
                  {activeComparisonCard.secondary_type && (
                    <span className={`badge-secondary badge-secondary--${activeComparisonCard.secondary_type}`}>
                      {activeComparisonCard.secondary_type}
                    </span>
                  )}
                  {activeComparisonCard.priority && (
                    <span className={`badge-priority badge-priority--${activeComparisonCard.priority}`}>
                      {activeComparisonCard.priority}
                    </span>
                  )}
                </div>
              </div>

              <div className="comparison-card-content">
                <h4 className="comparison-card-title">
                  {renderTextWithMentions(activeComparisonCard.title)}
                </h4>

                <div className="comparison-card-desc-box">
                  <span className="comparison-card-desc-label">Descripción:</span>
                  {activeComparisonCard.description ? (
                    <p className="comparison-card-desc">
                      {renderTextWithMentions(activeComparisonCard.description)}
                    </p>
                  ) : (
                    <p className="comparison-card-desc comparison-card-desc--empty">
                      Esta tarjeta no tiene descripción detallada.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="¿Eliminar tarjeta?"
          message={`¿Estás seguro de que quieres eliminar la tarjeta "${card.display_id} — ${card.title}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar tarjeta"
          danger={true}
          onConfirm={() => {
            onDeleteCard?.(card.id)
            onClose()
          }}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>,
    document.body
  )
}
