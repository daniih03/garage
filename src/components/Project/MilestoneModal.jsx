import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'

export default function MilestoneModal({
  project,
  milestone = null,
  nextNumber,
  onMilestoneCreated,
  onMilestoneUpdated,
  onClose,
}) {
  const isEditing = Boolean(milestone)
  const [title,  setTitle]  = useState(milestone?.title ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const inputRef = useRef(null)

  const numToDisplay = milestone?.number ?? nextNumber

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('El nombre del hito es obligatorio.')
      return
    }

    setSaving(true)
    setError('')

    if (isEditing) {
      const { error: dbError } = await supabase
        .from('milestones')
        .update({ title: trimmed })
        .eq('id', milestone.id)

      if (dbError) {
        setError(dbError.message)
        setSaving(false)
      } else {
        onMilestoneUpdated?.({ ...milestone, title: trimmed })
        onClose()
      }
    } else {
      // 1. Obtener número máximo real de la BD para evitar violaciones de UNIQUE(project_id, number)
      let calculatedNumber = nextNumber || 1
      try {
        const { data: maxRow } = await supabase
          .from('milestones')
          .select('number')
          .eq('project_id', project.id)
          .order('number', { ascending: false })
          .limit(1)

        if (maxRow && maxRow.length > 0 && typeof maxRow[0].number === 'number') {
          calculatedNumber = Math.max(calculatedNumber, maxRow[0].number + 1)
        }
      } catch (err) {
        console.warn('Error verificando max milestone number:', err)
      }

      // 2. Insertar hito devolviendo la fila creada
      const { data: createdMilestone, error: dbError } = await supabase
        .from('milestones')
        .insert({
          project_id: project.id,
          number:     calculatedNumber,
          title:      trimmed,
        })
        .select()
        .single()

      if (dbError) {
        setError(dbError.message)
        setSaving(false)
      } else {
        onMilestoneCreated?.(createdMilestone)
        onClose()
      }
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="milestone-modal-title">
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="milestone-tab__num" style={{ fontSize: 11, padding: '2px 7px' }}>
              #{numToDisplay}
            </span>
            <h2 className="modal__title" id="milestone-modal-title">
              {isEditing ? 'Editar hito' : 'Nuevo hito'}
            </h2>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="milestone-name">
              Nombre del hito
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
              {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear hito'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
