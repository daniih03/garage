import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import {
  fetchUserRepos,
  fetchRepo,
  fetchRepoCollaborators,
  getAcronym,
  parseRepoInput,
  getStoredProviderToken,
} from '../../lib/github'

export default function AddProjectModal({ existingProjects, onClose }) {
  const [repos,       setRepos]       = useState([])
  const [filter,      setFilter]      = useState('')
  const [loadingRepos,setLoadingRepos]= useState(true)
  const [useManual,   setUseManual]   = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [selected,    setSelected]    = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const existingNames = new Set(existingProjects.map(p => p.repo_full_name.toLowerCase()))

  /* ── Load repos from GitHub API on mount ── */
  useEffect(() => {
    loadRepos()
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function loadRepos() {
    setLoadingRepos(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.provider_token || getStoredProviderToken()
      const username = session?.user?.user_metadata?.user_name

      const data = await fetchUserRepos(token, username)
      setRepos(data || [])
      setUseManual(false)
    } catch (err) {
      console.warn('Error loading user repos:', err)
      setRepos([])
    } finally {
      setLoadingRepos(false)
    }
  }

  /* ── Add project ── */
  async function handleAdd() {
    setSaving(true)
    setError('')

    let repoData = selected

    if (!repoData) {
      const ownerRepo = parseRepoInput(manualInput)
      if (!ownerRepo) {
        setError('Introduce una URL o formato "usuario/repo" válido.')
        setSaving(false)
        return
      }
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.provider_token || getStoredProviderToken()
        repoData = await fetchRepo(ownerRepo, token)
      } catch {
        setError('Repositorio no encontrado o sin permisos de acceso.')
        setSaving(false)
        return
      }
    }

    if (existingNames.has(repoData.full_name.toLowerCase())) {
      setError('Este repositorio ya está añadido a Garage.')
      setSaving(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    const token = session?.provider_token || getStoredProviderToken()

    let collabs = []
    if (token) {
      collabs = await fetchRepoCollaborators(repoData.full_name, token)
    }

    const collabsList = Array.from(new Set([
      ...collabs,
      repoData.owner?.login?.toLowerCase(),
      user?.user_metadata?.user_name?.toLowerCase(),
    ].filter(Boolean)))

    const { error: dbError } = await supabase.from('projects').insert({
      repo_full_name:       repoData.full_name,
      repo_name:            repoData.name,
      repo_url:             repoData.html_url,
      repo_acronym:         getAcronym(repoData.name),
      description:          repoData.description ?? null,
      created_by:           user?.id ?? null,
      github_collaborators: collabsList,
    })

    if (dbError) {
      if (dbError.code === '23505') {
        setError('Este repositorio ya está añadido a Garage.')
      } else {
        setError(dbError.message)
      }
      setSaving(false)
    } else {
      onClose()
    }
  }

  const filteredRepos = repos.filter(r =>
    r.full_name.toLowerCase().includes(filter.toLowerCase()) &&
    !existingNames.has(r.full_name.toLowerCase())
  )

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-project-title">
        <div className="modal__header">
          <h2 className="modal__title" id="add-project-title">Añadir proyecto</h2>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__form">
          {useManual ? (
            /* ── Manual URL / input ── */
            <div className="form-group">
              <label className="form-label" htmlFor="manual-repo">URL o nombre del repositorio</label>
              <input
                id="manual-repo"
                type="text"
                className="form-input"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder="https://github.com/usuario/repo  ó  usuario/repo"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <button type="button" className="toggle-link" onClick={() => { setUseManual(false); loadRepos() }}>
                ← Volver a lista de repositorios
              </button>
            </div>
          ) : loadingRepos ? (
            /* ── Loading skeleton ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ height: 48, borderRadius: 6 }} />
              ))}
            </div>
          ) : (
            /* ── Repo list ── */
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar en mis repositorios…"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={loadRepos}
                  title="Actualizar lista de repositorios desde GitHub"
                  aria-label="Actualizar repositorios"
                  disabled={loadingRepos}
                  style={{ flexShrink: 0 }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ animation: loadingRepos ? 'spin 0.65s linear infinite' : 'none' }}
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  Recargar
                </button>
              </div>

              <div className="repo-list">
                {filteredRepos.length === 0 ? (
                  <div className="repo-list__empty" style={{ padding: '16px 12px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 13 }}>
                      {repos.length === 0
                        ? 'No se encontraron repositorios automáticamente.'
                        : 'Sin resultados para esa búsqueda.'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Si tu repo es privado o lo acabas de crear, puedes pulsar "Recargar" o introducir "usuario/repo" en modo manual.
                    </p>
                  </div>
                ) : (
                  filteredRepos.map(repo => (
                    <button
                      key={repo.id}
                      type="button"
                      className={`repo-item${selected?.id === repo.id ? ' repo-item--selected' : ''}`}
                      onClick={() => setSelected(selected?.id === repo.id ? null : repo)}
                    >
                      <div className="repo-item__name">{repo.full_name}</div>
                      {repo.description && (
                        <div className="repo-item__desc">{repo.description}</div>
                      )}
                      {repo.private && <span className="tag tag--muted" style={{ marginTop: 4 }}>Privado</span>}
                    </button>
                  ))
                )}
              </div>

              <button type="button" className="toggle-link" onClick={() => setUseManual(true)}>
                Introducir URL o nombre ("usuario/repo") manualmente
              </button>
            </>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleAdd}
              disabled={saving || (!selected && !manualInput.trim())}
            >
              {saving ? 'Añadiendo…' : 'Añadir proyecto'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
