import { useState } from 'react'
import { supabase } from '../../lib/supabase'

// GitHub OAuth redirects back to the deployed URL after authentication
const REDIRECT_URL = 'https://daniih03.github.io/garage'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGitHubLogin() {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: REDIRECT_URL,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success the browser redirects automatically — no need to reset state
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <svg width="44" height="44" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="8" fill="#D35400" />
            <path d="M8 28L14 11L21 22L25.5 15L33 28H8Z" fill="white" fillOpacity="0.92" />
          </svg>
          <span className="login-logo__text">GARAGE</span>
        </div>

        <h1 className="login-title">Bienvenido</h1>

        <p className="login-subtitle">
          Gestión colaborativa de proyectos<br />
          de hardware y software.
        </p>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          className="btn btn--github"
          onClick={handleGitHubLogin}
          disabled={loading}
          aria-busy={loading}
        >
          {/* GitHub icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          {loading ? 'Redirigiendo a GitHub…' : 'Continuar con GitHub'}
        </button>

        <p className="login-footer">
          Acceso restringido · Solo usuarios autorizados
        </p>
      </div>
    </div>
  )
}
