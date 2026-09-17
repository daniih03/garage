/**
 * GitHub API helpers
 * Uses the provider_token stored in the Supabase OAuth session or localStorage.
 */

const API = 'https://api.github.com'

const TOKEN_KEY = 'garage_github_token'

export function getStoredProviderToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

export function setStoredProviderToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Ignore storage quota or disabled localStorage
  }
}

export function clearStoredProviderToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Ignore
  }
}

const headers = (token) => ({
  Accept: 'application/vnd.github.v3+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

/**
 * List all repos the user has access to.
 * Checks via authenticated endpoint (includes private repos if 'repo' scope was granted).
 * Falls back to public user repos endpoint if token is unavailable.
 */
export async function fetchUserRepos(token, username) {
  const authToken = token || getStoredProviderToken()

  // 1. Try authenticated /user/repos
  if (authToken) {
    try {
      const res = await fetch(
        `${API}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
        { headers: headers(authToken) }
      )
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) return data
      }
    } catch (e) {
      console.warn('Error calling /user/repos with token, trying fallback', e)
    }
  }

  // 2. Fallback: public repos for user
  if (username) {
    try {
      const res = await fetch(
        `${API}/users/${username}/repos?per_page=100&sort=updated`,
        { headers: headers(authToken) }
      )
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) return data
      }
    } catch (e) {
      console.warn('Error calling /users/:username/repos fallback', e)
    }
  }

  return []
}

/** Fetch a single repo by "owner/repo" */
export async function fetchRepo(ownerRepo, token) {
  const authToken = token || getStoredProviderToken()
  const res = await fetch(`${API}/repos/${ownerRepo}`, { headers: headers(authToken) })
  if (!res.ok) throw new Error(`Repositorio no encontrado: ${ownerRepo}`)
  return res.json()
}

/** Fetch collaborators for a repo */
export async function fetchRepoCollaborators(ownerRepo, token) {
  const authToken = token || getStoredProviderToken()
  try {
    const res = await fetch(`${API}/repos/${ownerRepo}/collaborators?per_page=100`, {
      headers: headers(authToken),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data.map(u => u.login.toLowerCase()) : []
  } catch {
    return []
  }
}

/** Fetch collaborators with full details (username, avatar_url, html_url) */
export async function fetchRepoCollaboratorsDetails(ownerRepo, token) {
  const authToken = token || getStoredProviderToken()
  try {
    const res = await fetch(`${API}/repos/${ownerRepo}/collaborators?per_page=100`, {
      headers: headers(authToken),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data)
      ? data.map(u => ({
          username: u.login,
          avatar_url: u.avatar_url || `https://github.com/${u.login}.png?size=64`,
          html_url: u.html_url,
        }))
      : []
  } catch {
    return []
  }
}

/**
 * Derive a smart acronym from a repo name:
 * - Handles camelCase, dashes, underscores, spaces and dots.
 * - Retains digits (e.g. "v2", "2026") and vowels for short acronyms/initials.
 * - Distributes letters across words so long names differentiate properly (e.g. backend vs frontend).
 * - Filters minor stop words when there are 3+ words.
 * - Max length 6 chars (standard uppercase alfanumeric).
 *
 * Examples:
 *   "garage"                         → "GRG"
 *   "garage-tool"                    → "GRGTL"
 *   "my-long-project-backend"        → "MLPB"
 *   "my-long-project-frontend"       → "MLPF"
 *   "sistema de facturacion 2"       → "SF2"
 */
export function getAcronym(repoName) {
  if (!repoName || typeof repoName !== 'string') return 'PRJ'
  const STOP_WORDS = new Set([
    'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'en', 'para', 'por', 'con',
    'a', 'the', 'of', 'and', 'for', 'in', 'on', 'to', 'with', 'by'
  ])

  const splitStr = repoName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9\s-_.]/g, ' ')

  let tokens = splitStr
    .split(/[\s\-_.]+/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)

  if (tokens.length === 0) return 'PRJ'

  if (tokens.length > 2) {
    const filtered = tokens.filter(t => !STOP_WORDS.has(t))
    if (filtered.length >= 2) tokens = filtered
  }

  const getConsonantsOrChars = (t) => {
    if (/^[a-z]?\d+$/i.test(t)) return t
    const cons = t.split('').filter(c => /[bcdfghjklmnpqrstvwxyz0-9]/.test(c)).join('')
    const collapsed = cons.replace(/(.)\1+/g, '$1')
    return collapsed.length >= 1 ? collapsed : t.replace(/[^a-z0-9]/g, '')
  }

  let result = ''

  if (tokens.length === 1) {
    const t = tokens[0]
    const cons = t.split('').filter(c => /[bcdfghjklmnpqrstvwxyz0-9]/.test(c)).join('')
    const collapsed = cons.replace(/(.)\1+/g, '$1')
    if (collapsed.length >= 2) {
      result = collapsed.slice(0, 6)
    } else {
      result = t.slice(0, 4)
    }
  } else if (tokens.length === 2) {
    const c1 = getConsonantsOrChars(tokens[0])
    const c2 = getConsonantsOrChars(tokens[1])
    result = (c1.slice(0, 3) + c2.slice(0, 3)).slice(0, 6)
  } else if (tokens.length === 3) {
    const c1 = getConsonantsOrChars(tokens[0])
    const c2 = getConsonantsOrChars(tokens[1])
    const c3 = getConsonantsOrChars(tokens[2])
    result = (c1.slice(0, 2) + c2.slice(0, 2) + c3.slice(0, 2)).slice(0, 6)
  } else {
    result = tokens.slice(0, 6).map(t => {
      if (/^[a-z]?\d+$/i.test(t)) return t
      return t[0] || ''
    }).join('').slice(0, 6)
    if (result.length < 3) {
      result = (tokens[0].slice(0, 2) + tokens.slice(1).map(t => /^[a-z]?\d+$/i.test(t) ? t : (t[0] || '')).join('')).slice(0, 6)
    }
  }

  result = result.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return result || repoName.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'PRJ'
}

/**
 * Parse a GitHub repo from either:
 *   - A full URL:  "https://github.com/owner/repo"
 *   - Short form:  "owner/repo"
 * Returns "owner/repo" or null if invalid.
 */
export function parseRepoInput(input) {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/github\.com\/([^/\s]+\/[^/\s]+)/)
  if (urlMatch) return urlMatch[1].replace(/\.git$/, '')
  if (/^[^/\s]+\/[^/\s]+$/.test(trimmed)) return trimmed
  return null
}
