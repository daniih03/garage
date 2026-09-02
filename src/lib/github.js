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

/**
 * Derive an acronym from a repo name using its consonants (uppercase, max 6).
 * Falls back to the first 4 chars if no consonants are found.
 */
export function getAcronym(repoName) {
  const cleaned = repoName.toLowerCase().replace(/[-_.\s]/g, '')
  const consonants = cleaned
    .split('')
    .filter((c) => /[bcdfghjklmnpqrstvwxyz]/.test(c))
    .join('')
    .toUpperCase()
    .slice(0, 6)
  return consonants || repoName.slice(0, 4).toUpperCase()
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
