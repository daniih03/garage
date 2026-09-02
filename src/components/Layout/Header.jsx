import { supabase } from '../../lib/supabase'

export default function Header({ user, view, activeProject, onGoHome }) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const avatarUrl = user?.user_metadata?.avatar_url
  const username  = user?.user_metadata?.user_name || user?.email?.split('@')[0] || 'Usuario'

  return (
    <header className="header" role="banner">
      {/* Left side */}
      <div className="header__left">
        {view === 'project' ? (
          <>
            <button
              className="header__back-btn"
              onClick={onGoHome}
              aria-label="Volver a proyectos"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <nav className="header__breadcrumb" aria-label="Ruta">
              <span
                className="header__breadcrumb-home"
                onClick={onGoHome}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onGoHome()}
              >
                Proyectos
              </span>
              <span className="header__breadcrumb-sep" aria-hidden="true">/</span>
              <span className="header__breadcrumb-current">{activeProject?.repo_name}</span>
              <span className="header__badge" aria-label={`Acrónimo: ${activeProject?.repo_acronym}`}>
                {activeProject?.repo_acronym}
              </span>
            </nav>
          </>
        ) : (
          <div className="header__brand">
            <svg width="26" height="26" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <rect width="40" height="40" rx="6" fill="#a51500" />
              <path d="M8 28L14 11L21 22L25.5 15L33 28H8Z" fill="white" fillOpacity="0.92" />
            </svg>
            <span className="header__brand-name">GARAGE</span>
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
