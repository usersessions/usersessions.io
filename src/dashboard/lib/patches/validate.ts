/**
 * Patch payload safety.
 *
 * Everything in a UI patch ends up executed inside a *customer's* page by capture.js.
 * This is the single server-side gate: it runs when a patch is created (executor),
 * when it is promoted (patches/manage) and when it is served (patches/active).
 * capture.js mirrors the attribute allow-list as defence in depth.
 */

export const PATCH_TYPES = ['css', 'text', 'attribute', 'redirect'] as const
export type PatchType = typeof PATCH_TYPES[number]

/** Attributes a patch may set. Anything that can execute script (on*, srcdoc, style) is excluded. */
export const SAFE_ATTRIBUTES: readonly string[] = [
  'href', 'title', 'alt', 'placeholder', 'aria-label', 'aria-hidden', 'aria-disabled',
  'aria-describedby', 'disabled', 'role', 'tabindex', 'type', 'value', 'target', 'rel',
]

const SAFE_ATTRIBUTE_SET = new Set(SAFE_ATTRIBUTES)
const URL_ATTRIBUTES = new Set(['href'])
const DANGEROUS_URL_SCHEME = /^\s*(javascript|data|vbscript|file|blob):/i
const SAFE_URL = /^(https?:\/\/|\/|\.\/|\.\.\/|#|\?)/i

// CSS values that can execute or fetch in some engine.
const DANGEROUS_CSS_VALUE = /(expression\s*\(|url\s*\(\s*['"]?\s*(javascript|data|vbscript):|progid\s*:|-moz-binding|@import|<\/?script)/i
// CSS properties that can load or execute code in legacy engines, regardless of value.
const DANGEROUS_CSS_PROPERTIES = new Set(['behavior', '-moz-binding', 'mozbinding', 'binding', '-ms-behavior'])

export const MAX_TEXT_LENGTH = 2000
export const MAX_STYLE_PROPERTIES = 50

export interface PatchValidation {
  ok: boolean
  reason?: string
}

function fail(reason: string): PatchValidation {
  return { ok: false, reason }
}

export function validatePatchPayload(patchType: unknown, payload: unknown): PatchValidation {
  if (typeof patchType !== 'string' || !(PATCH_TYPES as readonly string[]).includes(patchType)) {
    return fail(`Unknown patch_type '${String(patchType)}'`)
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return fail('patch_payload must be an object')
  }
  const p = payload as Record<string, unknown>

  switch (patchType as PatchType) {
    case 'css': {
      const styles = p.styles
      if (!styles || typeof styles !== 'object' || Array.isArray(styles)) {
        return fail('css patch requires payload.styles object')
      }
      const entries = Object.entries(styles as Record<string, unknown>)
      if (entries.length === 0) return fail('css patch has no styles')
      if (entries.length > MAX_STYLE_PROPERTIES) return fail('too many style properties')
      for (const [prop, value] of entries) {
        if (DANGEROUS_CSS_PROPERTIES.has(prop.trim().toLowerCase())) {
          return fail(`style property '${prop}' is not allowed`)
        }
        if (typeof value !== 'string' && typeof value !== 'number') {
          return fail(`style '${prop}' must be a string or number`)
        }
        if (DANGEROUS_CSS_VALUE.test(String(value))) {
          return fail(`style '${prop}' contains a disallowed value`)
        }
      }
      return { ok: true }
    }

    case 'text': {
      if (typeof p.text !== 'string') return fail('text patch requires payload.text string')
      if (p.text.length > MAX_TEXT_LENGTH) return fail(`text exceeds ${MAX_TEXT_LENGTH} characters`)
      return { ok: true }
    }

    case 'attribute': {
      const attr = typeof p.attr === 'string' ? p.attr.trim().toLowerCase() : ''
      if (!SAFE_ATTRIBUTE_SET.has(attr)) return fail(`attribute '${attr}' is not on the allow-list`)
      if (p.action === 'remove') return { ok: true }
      if (typeof p.val !== 'string') return fail('attribute patch requires payload.val string')
      if (p.val.length > MAX_TEXT_LENGTH) return fail('attribute value too long')
      if (URL_ATTRIBUTES.has(attr) && (DANGEROUS_URL_SCHEME.test(p.val) || !SAFE_URL.test(p.val))) {
        return fail('href must be http(s), relative, or a fragment')
      }
      return { ok: true }
    }

    case 'redirect': {
      if (typeof p.href !== 'string') return fail('redirect patch requires payload.href string')
      if (DANGEROUS_URL_SCHEME.test(p.href) || !SAFE_URL.test(p.href)) {
        return fail('redirect href must be http(s) or relative')
      }
      return { ok: true }
    }
  }
}
