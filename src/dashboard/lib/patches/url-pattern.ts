/**
 * URL pattern matching for UI patches.
 *
 * `us_ui_patches.url_pattern` is matched against `location.pathname`:
 *   null / ''          -> whole site
 *   '/pricing'         -> exact path
 *   '/docs/*'          -> prefix wildcard
 *   '/account/*\/edit' -> '*' matches any run of characters
 */
export function matchesUrlPattern(pattern: string | null | undefined, path: string): boolean {
  if (!pattern || pattern.trim() === '' || pattern.trim() === '*') return true
  const escaped = pattern
    .trim()
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  try {
    return new RegExp(`^${escaped}$`, 'i').test(path)
  } catch {
    return false
  }
}
