/**
 * GitHub API helpers
 * Uses the provider_token stored in the Supabase OAuth session.
 */

const API = 'https://api.github.com'

const headers = (token) => ({
  Accept: 'application/vnd.github.v3+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

/** List all repos the authenticated user has access to */
export async function fetchUserRepos(token) {
  const res = await fetch(
    `${API}/user/repos?per_page=100&sort=updated&type=all`,
    { headers: headers(token) }
  )
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  return res.json()
}

/** Fetch a single repo by "owner/repo" (public repos don't need a token) */
export async function fetchRepo(ownerRepo, token) {
  const res = await fetch(`${API}/repos/${ownerRepo}`, { headers: headers(token) })
  if (!res.ok) throw new Error(`Repositorio no encontrado: ${ownerRepo}`)
  return res.json()
}

/**
 * Derive an acronym from a repo name using its consonants (uppercase, max 6).
 * Falls back to the first 4 chars if no consonants are found.
 *
 * Examples:
 *   "garage"     → "GRG"
 *   "my-project" → "MYPRJCT" → "MYPRJC"
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
