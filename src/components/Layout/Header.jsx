import { supabase } from '../../lib/supabase'

export default function Header({ user }) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const avatarUrl  = user?.user_metadata?.avatar_url
  const username   = user?.user_metadata?.user_name || user?.email?.split('@')[0] || 'Usuario'

  return (
    <header className="header" role="banner">
      {/* Brand */}
      <div className="header__brand">
        <svg width="26" height="26" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect width="40" height="40" rx="6" fill="#D35400" />
          <path d="M8 28L14 11L21 22L25.5 15L33 28H8Z" fill="white" fillOpacity="0.92" />
        </svg>
        <span className="header__brand-name">GARAGE</span>
      </div>

      {/* Right side: user info + logout */}
      <div className="header__right">
        <div className="header__user" aria-label={`Conectado como ${username}`}>
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
