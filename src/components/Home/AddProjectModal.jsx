import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchUserRepos, fetchRepo, getAcronym, parseRepoInput } from '../../lib/github'

export default function AddProjectModal({ existingProjects, onClose }) {
  const [repos,       setRepos]       = useState([])
  const [filter,      setFilter]      = useState('')
  const [loadingRepos,setLoadingRepos]= useState(true)
  const [useManual,   setUseManual]   = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [selected,    setSelected]    = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const existingNames = new Set(existingProjects.map(p => p.repo_full_name))

  /* ── Load repos from GitHub API on mount ── */
  useEffect(() => {
    loadRepos()
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function loadRepos() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.provider_token
      if (!token) { setUseManual(true); setLoadingRepos(false); return }
      const data = await fetchUserRepos(token)
      setRepos(data)
    } catch {
      setUseManual(true)
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
        setError('Introduce una URL o "propietario/repo" válido.')
        setSaving(false)
        return
      }
      try {
        const { data: { session } } = await supabase.auth.getSession()
        repoData = await fetchRepo(ownerRepo, session?.provider_token)
      } catch {
        setError('Repositorio no encontrado o sin acceso.')
        setSaving(false)
        return
      }
    }

    if (existingNames.has(repoData.full_name)) {
      setError('Este repositorio ya está añadido.')
      setSaving(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { error: dbError } = await supabase.from('projects').insert({
      repo_full_name: repoData.full_name,
      repo_name:      repoData.name,
      repo_url:       repoData.html_url,
      repo_acronym:   getAcronym(repoData.name),
      description:    repoData.description ?? null,
      created_by:     user?.id ?? null,
    })

    if (dbError) { setError(dbError.message); setSaving(false) }
    else onClose()
  }

  const filteredRepos = repos.filter(r =>
    r.full_name.toLowerCase().includes(filter.toLowerCase()) &&
    !existingNames.has(r.full_name)
  )

  return (
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
            /* ── Manual URL input ── */
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
                Cargar desde mi cuenta de GitHub
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
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar repositorios…"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="repo-list">
                {filteredRepos.length === 0 ? (
                  <p className="repo-list__empty">
                    {repos.length === 0
                      ? 'No se encontraron repositorios en tu cuenta.'
                      : 'Sin resultados para esa búsqueda.'}
                  </p>
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
                Introducir URL manualmente
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
    </div>
  )
}
