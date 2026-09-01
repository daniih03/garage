import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const STATUS_OPTIONS = [
  { id: 'todo',       label: 'Por hacer'   },
  { id: 'inprogress', label: 'En progreso' },
  { id: 'done',       label: 'Terminado'   },
]

export default function CardModal({ card, defaultStatus, cardsInColumn, onClose }) {
  const isEditing = Boolean(card)

  const [form, setForm]     = useState({
    title:      card?.title      ?? '',
    description:card?.description ?? '',
    github_url: card?.github_url  ?? '',
    status:     card?.status      ?? defaultStatus,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const titleRef = useRef(null)

  /* Focus title on open & close on Escape */
  useEffect(() => {
    titleRef.current?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const title = form.title.trim()
    if (!title) {
      setError('El título es obligatorio.')
      titleRef.current?.focus()
      return
    }

    setSaving(true)

    const payload = {
      title,
      description: form.description.trim() || null,
      github_url:  form.github_url.trim()  || null,
      status:      form.status,
      updated_at:  new Date().toISOString(),
    }

    let dbError

    if (isEditing) {
      ;({ error: dbError } = await supabase
        .from('cards')
        .update(payload)
        .eq('id', card.id))
    } else {
      // Compute next position in target column
      const sibling = cardsInColumn.filter(c => c.status === form.status)
      const newPosition = sibling.length > 0
        ? Math.max(...sibling.map(c => c.position)) + 1
        : 0

      const { data: { user } } = await supabase.auth.getUser()

      ;({ error: dbError } = await supabase
        .from('cards')
        .insert({
          ...payload,
          position:   newPosition,
          created_by: user?.id ?? null,
        }))
    }

    if (dbError) {
      setError(dbError.message)
      setSaving(false)
    } else {
      onClose()
    }
  }

  /* Close on overlay click */
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="modal__header">
          <h2 className="modal__title" id="modal-title">
            {isEditing ? 'Editar tarjeta' : 'Nueva tarjeta'}
          </h2>
          <button
            className="modal__close"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form className="modal__form" onSubmit={handleSubmit} noValidate>

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="card-title">
              Título <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              ref={titleRef}
              id="card-title"
              name="title"
              type="text"
              className={`form-input${error ? ' form-input--error' : ''}`}
              value={form.title}
              onChange={handleChange}
              placeholder="Nombre de la tarea…"
              maxLength={120}
              aria-required="true"
              aria-describedby={error ? 'title-error' : undefined}
            />
            {error && (
              <span id="title-error" className="form-error" role="alert">
                {error}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="card-description">
              Descripción
            </label>
            <textarea
              id="card-description"
              name="description"
              className="form-textarea"
              value={form.description}
              onChange={handleChange}
              placeholder="Detalles, objetivos, notas…"
              rows={3}
            />
          </div>

          {/* GitHub URL */}
          <div className="form-group">
            <label className="form-label" htmlFor="card-github">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 5 }} aria-hidden="true">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              Repositorio GitHub
            </label>
            <input
              id="card-github"
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
              {STATUS_OPTIONS.map(s => (
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
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Guardando…' : isEditing ? 'Actualizar' : 'Crear tarjeta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
