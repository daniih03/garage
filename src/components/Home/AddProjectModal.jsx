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
  const [repos,          setRepos]          = useState([])
  const [filter,         setFilter]         = useState('')
  const [loadingRepos,   setLoadingRepos]   = useState(true)
  const [useManual,      setUseManual]      = useState(false)
  const [manualInput,    setManualInput]    = useState('')
  const [selected,       setSelected]       = useState(null)
  const [projectName,    setProjectName]    = useState('')
  const [projectDesc,    setProjectDesc]    = useState('')
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')

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

  function handleSelectRepo(repo) {
    setSelected(repo)
    setProjectName(repo.name)
    setProjectDesc(repo.description || '')
    setError('')
  }

  async function handleConfirmManual() {
    const ownerRepo = parseRepoInput(manualInput)
    if (!ownerRepo) {
      setError('Introduce una URL o formato "usuario/repo" válido.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.provider_token || getStoredProviderToken()
      const repoData = await fetchRepo(ownerRepo, token)
      handleSelectRepo(repoData)
    } catch {
      setError('Repositorio no encontrado o sin permisos de acceso.')
    } finally {
      setSaving(false)
    }
  }

  /* ── Add project ── */
  async function handleAdd() {
    if (!selected) return

    const trimmedName = projectName.trim()
    if (!trimmedName) {
      setError('El nombre del proyecto es obligatorio.')
      return
    }

    if (existingNames.has(selected.full_name.toLowerCase())) {
      setError('Este repositorio ya está añadido a Garage.')
      return
    }

    setSaving(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    const token = session?.provider_token || getStoredProviderToken()

    let collabs = []
    if (token) {
      collabs = await fetchRepoCollaborators(selected.full_name, token)
    }

    const collabsList = Array.from(new Set([
      ...collabs,
      selected.owner?.login?.toLowerCase(),
      user?.user_metadata?.user_name?.toLowerCase(),
    ].filter(Boolean)))

    const projectId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined

    const projectPayload = {
      repo_full_name:       selected.full_name,
      repo_name:            trimmedName,
      repo_url:             selected.html_url,
      repo_acronym:         getAcronym(trimmedName),
      description:          projectDesc.trim() || null,
      created_by:           user?.id ?? null,
      github_collaborators: collabsList,
    }
    if (projectId) projectPayload.id = projectId

    const { error: dbError } = await supabase.from('projects').insert(projectPayload)

    if (dbError) {
      if (dbError.code === '23505') {
        setError('Este repositorio ya está añadido a Garage.')
      } else {
        setError(dbError.message)
      }
      setSaving(false)
      return
    }

    // Asegurar explícitamente al creador en project_members como owner
    if (projectId && user) {
      await supabase.from('project_members').upsert({
        project_id: projectId,
        user_id:    user.id,
        added_by:   user.id,
        role:       'owner',
      }, { onConflict: 'project_id, user_id' })
    }

    onClose()
  }

  const filteredRepos = repos.filter(r =>
    r.full_name.toLowerCase().includes(filter.toLowerCase()) &&
    !existingNames.has(r.full_name.toLowerCase())
  )

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-project-title">
        <div className="modal__header">
          <h2 className="modal__title" id="add-project-title">
            {selected ? 'Detalles del proyecto' : 'Añadir proyecto'}
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__form">
          {/* ── STEP 2: Configure Project Name & Description ── */}
          {selected ? (
            <>
              {/* Repo info banner */}
              <div className="selected-repo-banner">
                <div className="selected-repo-banner__info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ opacity: 0.85, flexShrink: 0 }}>
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  <div>
                    <div className="selected-repo-banner__tag">Repositorio GitHub</div>
                    <div className="selected-repo-banner__name">{selected.full_name}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSelected(null)}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  Cambiar
                </button>
              </div>

              {/* Editable project name */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="proj-name">
                    Nombre del proyecto <span className="required">*</span>
                  </label>
                  {projectName.trim() && (
                    <span className="display-id-badge" style={{ fontSize: 10, padding: '1px 6px' }}>
                      ID: {getAcronym(projectName)}
                    </span>
                  )}
                </div>
                <input
                  id="proj-name"
                  type="text"
                  className="form-input"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="Nombre representativo del proyecto…"
                  autoFocus
                  required
                />
              </div>

              {/* Editable brief description */}
              <div className="form-group">
                <label className="form-label" htmlFor="proj-desc">
                  Breve descripción
                </label>
                <textarea
                  id="proj-desc"
                  className="form-textarea"
                  value={projectDesc}
                  onChange={e => setProjectDesc(e.target.value)}
                  placeholder="Resumen del propósito y objetivos del proyecto…"
                  rows={3}
                />
              </div>
            </>
          ) : useManual ? (
            /* ── STEP 1 (Manual): URL or username/repo input ── */
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
                onKeyDown={e => e.key === 'Enter' && handleConfirmManual()}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handleConfirmManual}
                disabled={saving || !manualInput.trim()}
                style={{ marginTop: 6 }}
              >
                {saving ? 'Buscando…' : 'Seleccionar este repositorio'}
              </button>
              <button
                type="button"
                className="toggle-link"
                onClick={() => { setUseManual(false); loadRepos() }}
                style={{ marginTop: 8 }}
              >
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
            /* ── STEP 1 (List): Browse repos ── */
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
                      className="repo-item"
                      onClick={() => handleSelectRepo(repo)}
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
            {selected && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleAdd}
                disabled={saving || !projectName.trim()}
              >
                {saving ? 'Creando…' : 'Crear proyecto'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
