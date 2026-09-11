/**
 * Cloudflare-compatible environment variable helper.
 *
 * In Cloudflare Workers (via OpenNext), env vars set in the Cloudflare dashboard
 * are exposed as bindings on the Worker's `env` object — NOT on `process.env`.
 * This helper tries the Cloudflare context first, then falls back to process.env
 * so it works both in production (Cloudflare) and locally (process.env).
 */
import { getCloudflareContext } from '@opennextjs/cloudflare'

let _cfEnvCache: Record<string, string | undefined> | null = null

export async function getCFEnv(): Promise<Record<string, string | undefined>> {
  if (_cfEnvCache) return _cfEnvCache
  try {
    const ctx = await getCloudflareContext({ async: true })
    _cfEnvCache = ctx.env as Record<string, string | undefined>
    return _cfEnvCache
  } catch {
    // Not running in a Cloudflare Worker (e.g. local dev) — fall back to process.env
    return process.env as Record<string, string | undefined>
  }
}

export async function getEnvVar(key: string): Promise<string | undefined> {
  const env = await getCFEnv()
  return env[key] ?? process.env[key]
}
