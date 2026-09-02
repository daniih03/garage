import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'

export default function InviteModal({ project, currentMembers, onClose }) {
  const [username, setUsername] = useState('')
  const [found,    setFound]    = useState(null)   // profile object if found
  const [status,   setStatus]   = useState('')     // 'searching' | 'found' | 'not-found' | 'already' | 'added'
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const inputRef = useRef(null)

  const memberIds = new Set(currentMembers.map(m => m.user_id))

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSearch(e) {
    e.preventDefault()
    const q = username.trim().toLowerCase().replace(/^@/, '')
    if (!q) return

    setStatus('searching')
    setFound(null)
    setError('')

    const { data, error: dbError } = await supabase
      .from('profiles')
      .select('id, github_username, avatar_url')
      .ilike('github_username', q)
      .single()

    if (dbError || !data) {
      setStatus('not-found')
      return
    }

    if (memberIds.has(data.id)) {
      setFound(data)
      setStatus('already')
      return
    }

    setFound(data)
    setStatus('found')
  }

  async function handleInvite() {
    if (!found) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { error: dbError } = await supabase.from('project_members').insert({
      project_id: project.id,
      user_id:    found.id,
      added_by:   user?.id ?? null,
    })

    if (dbError) setError(dbError.message)
    else setStatus('added')
    setSaving(false)
  }

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <div className="modal__header">
          <h2 className="modal__title" id="invite-title">Invitar colaborador</h2>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSearch} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="invite-username">
              Usuario de GitHub
            </label>
            <div className="invite-search-row">
              <input
                ref={inputRef}
                id="invite-username"
                type="text"
                className="form-input"
                value={username}
                onChange={e => { setUsername(e.target.value); setStatus(''); setFound(null); setError('') }}
                placeholder="nombre_de_usuario"
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!username.trim() || status === 'searching'}
              >
                {status === 'searching' ? '…' : 'Buscar'}
              </button>
            </div>
          </div>

          {/* Result */}
          {status === 'not-found' && (
            <p className="invite-msg invite-msg--warn">
              Usuario no encontrado. Pídele que inicie sesión en Garage primero.
            </p>
          )}

          {(status === 'found' || status === 'already' || status === 'added') && found && (
            <div className="invite-result">
              {found.avatar_url
                ? <img src={found.avatar_url} alt={found.github_username} className="invite-result__avatar" />
                : <div className="invite-result__avatar invite-result__avatar--placeholder">{found.github_username[0].toUpperCase()}</div>
              }
              <div className="invite-result__info">
                <span className="invite-result__name">@{found.github_username}</span>
                {status === 'already' && <span className="invite-result__tag invite-result__tag--already">Ya es miembro</span>}
                {status === 'added'   && <span className="invite-result__tag invite-result__tag--added">✓ Añadido</span>}
              </div>
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {status === 'added' ? 'Cerrar' : 'Cancelar'}
            </button>
            {status === 'found' && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleInvite}
                disabled={saving}
              >
                {saving ? 'Añadiendo…' : 'Añadir al proyecto'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
