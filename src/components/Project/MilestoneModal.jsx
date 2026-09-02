import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function MilestoneModal({ project, nextNumber, onClose }) {
  const [title,  setTitle]  = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) { setError('El nombre del hito es obligatorio.'); return }

    setSaving(true)
    const { error: dbError } = await supabase.from('milestones').insert({
      project_id: project.id,
      number:     nextNumber,
      title:      trimmed,
    })

    if (dbError) { setError(dbError.message); setSaving(false) }
    else onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="milestone-modal-title">
        <div className="modal__header">
          <h2 className="modal__title" id="milestone-modal-title">Nuevo hito</h2>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="milestone-name">
              Nombre
              <span className="milestone-num-hint" aria-label={`Número de hito: ${nextNumber}`}>
                #{nextNumber}
              </span>
            </label>
            <input
              ref={inputRef}
              id="milestone-name"
              type="text"
              className={`form-input${error ? ' form-input--error' : ''}`}
              value={title}
              onChange={e => { setTitle(e.target.value); setError('') }}
              placeholder="Sprint 1, Fase HW, v1.0…"
              maxLength={80}
            />
            {error && <span className="form-error" role="alert">{error}</span>}
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Creando…' : 'Crear hito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
