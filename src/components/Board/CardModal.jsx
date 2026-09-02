import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../Common/ConfirmModal'

const STATUSES = [
  { id: 'todo',       label: 'Por hacer'   },
  { id: 'inprogress', label: 'En progreso' },
  { id: 'done',       label: 'Terminado'   },
]

const PRIMARY_TYPES   = ['HW', 'SW']
const SECONDARY_TYPES = ['task', 'bug', 'spike', 'stock']

const PRIORITIES = [
  { id: 'low',      label: 'Low',      color: '#5A5A5A' },
  { id: 'mid',      label: 'Mid',      color: '#3498DB' },
  { id: 'high',     label: 'High',     color: '#E67E22' },
  { id: 'critical', label: 'Critical', color: '#a51500' },
]

export default function CardModal({
  card,
  defaultStatus,
  project,
  milestone,
  cardsInStatus,
  onDeleteCard,
  onClose,
}) {
  const isEditing = Boolean(card)

  /* ── Form state ── */
  const [form, setForm] = useState({
    title:          card?.title          ?? '',
    description:    card?.description    ?? '',
    github_url:     card?.github_url     ?? '',
    status:         card?.status         ?? defaultStatus,
    primary_type:   card?.primary_type   ?? '',
    secondary_type: card?.secondary_type ?? '',
    priority:       card?.priority       ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  /* ── Comments state ── */
  const [comments,     setComments]     = useState([])
  const [newComment,   setNewComment]   = useState('')
  const [addingComment,setAddingComment]= useState(false)
  const [currentUser,  setCurrentUser]  = useState(null)

  const titleRef = useRef(null)

  /* ── Mount effects ── */
  useEffect(() => {
    titleRef.current?.focus()

    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))

    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)

    let channel
    if (isEditing && card.id) {
      loadComments()
      channel = supabase
        .channel(`comments-${card.id}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'card_comments', filter: `card_id=eq.${card.id}` },
          handleCommentChange
        )
        .subscribe()
    }

    return () => {
      document.removeEventListener('keydown', onKey)
      if (channel) supabase.removeChannel(channel)
    }
  }, [onClose, isEditing, card?.id])

  /* ── Comments helpers ── */
  async function loadComments() {
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

  async function handleAddComment() {
    const content = newComment.trim()
    if (!content) return
    setAddingComment(true)
    await supabase.from('card_comments').insert({
      card_id:    card.id,
      content,
      created_by: currentUser?.id ?? null,
    })
    setNewComment('')
    setAddingComment(false)
  }

  async function handleDeleteComment(id) {
    await supabase.from('card_comments').delete().eq('id', id)
  }

  /* ── Form helpers ── */
  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  function togglePill(field, value) {
    setForm(prev => ({ ...prev, [field]: prev[field] === value ? '' : value }))
  }

  /* ── Submit ── */
  async function handleSubmit(e) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) { setError('El título es obligatorio.'); titleRef.current?.focus(); return }

    setSaving(true)

    const payload = {
      title,
      description:    form.description.trim()    || null,
      github_url:     form.github_url.trim()      || null,
      status:         form.status,
      primary_type:   form.primary_type           || null,
      secondary_type: form.secondary_type         || null,
      priority:       form.priority               || null,
      updated_at: new Date().toISOString(),
    }

    let dbError

    if (isEditing) {
      ;({ error: dbError } = await supabase.from('cards').update(payload).eq('id', card.id))
    } else {
      /* Auto-generate card_number and display_id */
      const { data: maxData } = await supabase
        .from('cards')
        .select('card_number')
        .eq('project_id',  project.id)
        .eq('milestone_id', milestone.id)
        .order('card_number', { ascending: false })
        .limit(1)

      const nextNum  = (maxData?.[0]?.card_number ?? 0) + 1
      const displayId = `${project.repo_acronym}-${milestone.number}-${String(nextNum).padStart(3, '0')}`

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

  /* ── Formatting ── */
  function formatDate(iso) {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className="modal modal--lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
      >
        {/* Header */}
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
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="modal__scrollable">
          <form className="modal__form" onSubmit={handleSubmit} noValidate>

            {/* Title */}
            <div className="form-group">
              <label className="form-label" htmlFor="c-title">
                Título <span className="required" aria-hidden="true">*</span>
              </label>
              <input
                ref={titleRef}
                id="c-title"
                name="title"
                type="text"
                className={`form-input${error ? ' form-input--error' : ''}`}
                value={form.title}
                onChange={handleChange}
                placeholder="Breve y descriptivo…"
                maxLength={120}
                aria-required="true"
              />
              {error && <span className="form-error" role="alert">{error}</span>}
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="c-desc">Descripción</label>
              <textarea
                id="c-desc"
                name="description"
                className="form-textarea"
                value={form.description}
                onChange={handleChange}
                placeholder="Detalles, objetivos, contexto…"
                rows={3}
              />
            </div>

            {/* Primary + Secondary side by side */}
            <div className="form-row">
              <div className="form-group">
                <span className="form-label" id="primary-label">Primario</span>
                <div className="pill-group" role="group" aria-labelledby="primary-label">
                  {PRIMARY_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`pill${form.primary_type === t
                        ? ` pill--active pill--primary-${t.toLowerCase()}`
                        : ''}`}
                      onClick={() => togglePill('primary_type', t)}
                      aria-pressed={form.primary_type === t}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <span className="form-label" id="secondary-label">Secundario</span>
                <div className="pill-group" role="group" aria-labelledby="secondary-label">
                  {SECONDARY_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`pill${form.secondary_type === t ? ' pill--active' : ''}`}
                      onClick={() => togglePill('secondary_type', t)}
                      aria-pressed={form.secondary_type === t}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Priority */}
            <div className="form-group">
              <span className="form-label" id="priority-label">Prioridad</span>
              <div className="pill-group" role="group" aria-labelledby="priority-label">
                {PRIORITIES.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pill${form.priority === p.id ? ' pill--active' : ''}`}
                    style={form.priority === p.id ? { '--pill-active-color': p.color } : {}}
                    onClick={() => togglePill('priority', p.id)}
                    aria-pressed={form.priority === p.id}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* GitHub URL */}
            <div className="form-group">
              <label className="form-label" htmlFor="c-github">Repositorio GitHub</label>
              <input
                id="c-github"
                name="github_url"
                type="url"
                className="form-input"
                value={form.github_url}
                onChange={handleChange}
                placeholder="https://github.com/usuario/repo"
              />
            </div>

            {/* Status */}
            <div className="form-group">
              <span className="form-label" id="status-label">Estado</span>
              <div className="status-selector" role="radiogroup" aria-labelledby="status-label">
                {STATUSES.map(s => (
                  <label
                    key={s.id}
                    className={`status-option${form.status === s.id ? ' status-option--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={s.id}
                      checked={form.status === s.id}
                      onChange={handleChange}
                      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                      aria-label={s.label}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
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

          {/* ── Comments (edit mode only) ── */}
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

              {/* New comment input */}
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
    </div>
  )
}
