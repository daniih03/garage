import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'

export default function InviteModal({ project, currentMembers, onClose }) {
  const [username,    setUsername]    = useState('')
  const [found,       setFound]       = useState(null)
  const [status,      setStatus]      = useState('')     // '' | 'searching' | 'found' | 'not-found' | 'already' | 'added'
  const [error,       setError]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  const [matches,          setMatches]          = useState([])
  const [showMatches,      setShowMatches]      = useState(false)

  const inputRef    = useRef(null)
  const wrapperRef  = useRef(null)

  // Build a Set of member user_ids for fast lookups
  const memberIds = new Set(currentMembers.map(m => m.user_id).filter(Boolean))

  useEffect(() => {
    inputRef.current?.focus()
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))

    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)

    // Close dropdown when clicking outside
    const onClickOutside = e => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowMatches(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [onClose])

  /* ── Realtime autocomplete as user types ── */
  useEffect(() => {
    const q = username.trim().toLowerCase().replace(/^@/, '')
    if (!q) {
      setMatches([])
      setShowMatches(false)
      return
    }

    const timer = setTimeout(async () => {
      const { data, error: searchError } = await supabase
        .from('profiles')
        .select('id, github_username, avatar_url')
        .ilike('github_username', `%${q}%`)
        .limit(10)

      if (!searchError && data) {
        // Exclude logged-in user
        const filtered = data.filter(p => p.id !== currentUser?.id)
        setMatches(filtered)
        setShowMatches(filtered.length > 0)
      } else {
        setMatches([])
      }
    }, 180)

    return () => clearTimeout(timer)
  }, [username, currentUser?.id])

  function selectUser(userProfile) {
    setUsername(userProfile.github_username)
    setShowMatches(false)
    setError('')

    if (userProfile.id === currentUser?.id) {
      setError('No puedes invitarte a ti mismo.')
      setFound(null)
      setStatus('')
      return
    }

    if (memberIds.has(userProfile.id)) {
      // Already a member — block the action entirely
      setFound(userProfile)
      setStatus('already')
      return
    }

    setFound(userProfile)
    setStatus('found')
  }

  async function handleSearch(e) {
    e?.preventDefault()
    const q = username.trim().toLowerCase().replace(/^@/, '')
    if (!q) return

    setStatus('searching')
    setFound(null)
    setError('')
    setShowMatches(false)

    const { data, error: dbError } = await supabase
      .from('profiles')
      .select('id, github_username, avatar_url')
      .ilike('github_username', q)
      .single()

    if (dbError || !data) {
      setStatus('not-found')
      return
    }

    selectUser(data)
  }

  async function handleInvite() {
    if (!found || status !== 'found') return

    // Double-check they're not already a member before hitting DB
    if (memberIds.has(found.id)) {
      setStatus('already')
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: dbError } = await supabase.from('project_members').insert({
      project_id: project.id,
      user_id:    found.id,
      added_by:   user?.id ?? null,
    })

    if (dbError) {
      // Handle unique-constraint violation (race condition: already a member)
      if (dbError.code === '23505') {
        setStatus('already')
        setError('')
      } else {
        setError(dbError.message)
      }
    } else {
      setStatus('added')
    }
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
          <div className="form-group" ref={wrapperRef} style={{ position: 'relative' }}>
            <label className="form-label" htmlFor="invite-username">
              Usuario de Garage / GitHub
            </label>
            <div className="invite-search-row">
              <input
                ref={inputRef}
                id="invite-username"
                type="text"
                className="form-input"
                value={username}
                onChange={e => {
                  setUsername(e.target.value)
                  setStatus('')
                  setFound(null)
                  setError('')
                }}
                onFocus={() => {
                  if (matches.length > 0) setShowMatches(true)
                }}
                placeholder="Escribe el nombre de usuario…"
                autoComplete="off"
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!username.trim() || status === 'searching'}
              >
                {status === 'searching' ? '…' : 'Buscar'}
              </button>
            </div>

            {/* Autocomplete dropdown */}
            {showMatches && matches.length > 0 && (
              <div className="invite-matches-dropdown">
                <div className="invite-matches-dropdown__header">
                  Coincidencias de usuarios:
                </div>
                {matches.map(m => {
                  const isAlready = memberIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`invite-match-item${isAlready ? ' invite-match-item--already' : ''}`}
                      onClick={() => selectUser(m)}
                    >
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={m.github_username} className="invite-match-item__avatar" />
                      ) : (
                        <div className="invite-match-item__avatar invite-match-item__avatar--placeholder">
                          {m.github_username[0].toUpperCase()}
                        </div>
                      )}
                      <span className="invite-match-item__name">@{m.github_username}</span>
                      {isAlready && (
                        <span className="invite-match-item__tag">Ya es miembro</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Status feedback */}
          {status === 'not-found' && (
            <p className="invite-msg invite-msg--warn">
              Usuario no encontrado. Pídele que inicie sesión en Garage al menos una vez para registrar su perfil.
            </p>
          )}

          {status === 'already' && found && (
            <p className="invite-msg invite-msg--warn">
              <strong>@{found.github_username}</strong> ya forma parte del proyecto y no puede ser invitado de nuevo.
            </p>
          )}

          {(status === 'found' || status === 'added') && found && (
            <div className="invite-result">
              {found.avatar_url ? (
                <img src={found.avatar_url} alt={found.github_username} className="invite-result__avatar" />
              ) : (
                <div className="invite-result__avatar invite-result__avatar--placeholder">
                  {found.github_username[0].toUpperCase()}
                </div>
              )}
              <div className="invite-result__info">
                <span className="invite-result__name">@{found.github_username}</span>
                {status === 'added' && <span className="invite-result__tag invite-result__tag--added">✓ Invitación enviada</span>}
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
                {saving ? 'Enviando invitación…' : 'Invitar al proyecto'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
