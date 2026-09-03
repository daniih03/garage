import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { getAcronym } from '../../lib/github'

export default function EditProjectModal({ project, onProjectUpdated, onClose }) {
  const [projectName, setProjectName] = useState(project.repo_name ?? '')
  const [projectDesc, setProjectDesc] = useState(project.description ?? '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedName = projectName.trim()
    if (!trimmedName) {
      setError('El nombre del proyecto es obligatorio.')
      return
    }

    setSaving(true)
    setError('')

    const newAcronym = getAcronym(trimmedName)
    const updatedPayload = {
      repo_name:    trimmedName,
      repo_acronym: newAcronym,
      description:  projectDesc.trim() || null,
    }

    const { error: dbError } = await supabase
      .from('projects')
      .update(updatedPayload)
      .eq('id', project.id)

    if (dbError) {
      setError(dbError.message)
      setSaving(false)
    } else {
      onProjectUpdated?.({
        ...project,
        ...updatedPayload,
      })
      onClose()
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="edit-project-title">
        <div className="modal__header">
          <h2 className="modal__title" id="edit-project-title">Editar proyecto</h2>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit} noValidate>
          {/* Repo Info Banner */}
          <div className="selected-repo-banner">
            <div className="selected-repo-banner__info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ opacity: 0.85, flexShrink: 0 }}>
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              <div>
                <div className="selected-repo-banner__tag">Repositorio GitHub</div>
                <div className="selected-repo-banner__name">{project.repo_full_name}</div>
              </div>
            </div>
          </div>

          {/* Project Name */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="edit-proj-name">
                Nombre del proyecto <span className="required">*</span>
              </label>
              {projectName.trim() && (
                <span className="display-id-badge" style={{ fontSize: 10, padding: '1px 6px' }}>
                  ID: {getAcronym(projectName)}
                </span>
              )}
            </div>
            <input
              ref={inputRef}
              id="edit-proj-name"
              type="text"
              className="form-input"
              value={projectName}
              onChange={e => { setProjectName(e.target.value); setError('') }}
              placeholder="Nombre del proyecto…"
              required
            />
          </div>

          {/* Project Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="edit-proj-desc">
              Breve descripción
            </label>
            <textarea
              id="edit-proj-desc"
              className="form-textarea"
              value={projectDesc}
              onChange={e => setProjectDesc(e.target.value)}
              placeholder="Resumen o propósito del proyecto…"
              rows={3}
            />
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !projectName.trim()}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
