import { supabase } from '../../lib/supabase'
import { clearStoredProviderToken } from '../../lib/github'

export default function Header({ user, view, activeProject, onGoHome }) {
  async function handleLogout() {
    clearStoredProviderToken()
    await supabase.auth.signOut()
  }

  const avatarUrl = user?.user_metadata?.avatar_url
  const username  = user?.user_metadata?.user_name || user?.email?.split('@')[0] || 'Usuario'

  return (
    <header className="header" role="banner">
      {/* Left side: Always shows Garage Brand with Logo */}
      <div className="header__left">
        <button
          type="button"
          className="header__brand"
          onClick={onGoHome}
          title="Ir a proyectos"
          aria-label="Garage — Inicio"
        >
          <img
            src={`${import.meta.env.BASE_URL}logos/Command_NOBG_Blanco_C.png`}
            alt="Command Garage"
            className="header__logo-img"
            width="28"
            height="28"
          />
          <span className="header__brand-name">GARAGE</span>
        </button>

        {view === 'project' && activeProject && (
          <div className="header__project-nav">
            <span className="header__breadcrumb-sep" aria-hidden="true">/</span>
            <nav className="header__breadcrumb" aria-label="Proyecto activo">
              <span className="header__breadcrumb-current" title={activeProject.repo_name}>
                {activeProject.repo_name}
              </span>
              <span className="header__badge" aria-label={`Acrónimo: ${activeProject.repo_acronym}`}>
                {activeProject.repo_acronym}
              </span>
            </nav>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="header__right">
        <div className="header__user" aria-label={`Sesión: ${username}`}>
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={username}
              className="header__avatar"
              width="28"
              height="28"
            />
          )}
          <span className="header__username">{username}</span>
        </div>
        <button
          className="btn btn--ghost btn--sm"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
        >
          Salir
        </button>
      </div>
    </header>
  )
}
