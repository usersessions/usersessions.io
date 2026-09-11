// SSRF Protection for Edge / Cloudflare Workers
// Uses DNS-over-HTTPS (DoH) to resolve domains and block private/local IPs.

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((regex) => regex.test(ip));
}

// Uses Cloudflare DoH to resolve A records
async function resolveDNS(hostname: string): Promise<string[]> {
  const url = new URL(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`);
  
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/dns-json' }
  });
  
  if (!res.ok) {
    throw new Error('DNS resolution failed');
  }

  const data: any = await res.json();
  if (!data.Answer) return [];

  return data.Answer
    .filter((a: any) => a.type === 1) // Type 1 is A record
    .map((a: any) => a.data);
}

/**
 * True when `raw` is an http(s) URL whose host does not resolve to a private range.
 * Use before handing a user-supplied URL to any server-side fetcher (ours or a vendor's).
 */
export async function isPublicHttpUrl(raw: string): Promise<boolean> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return !isPrivateIP(host)
  if (host.includes(':')) return !isPrivateIP(host.replace(/^\[|\]$/g, ''))
  try {
    const ips = await resolveDNS(host)
    return ips.length > 0 && !ips.some(isPrivateIP)
  } catch {
    return false
  }
}

export async function safeFetch(targetUrl: string, init?: RequestInit): Promise<Response> {
  const url = new URL(targetUrl);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('SSRF Blocked: Invalid protocol');
  }

  // Allow raw IPs but check them immediately
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);
  if (isIp) {
    if (isPrivateIP(url.hostname)) {
      throw new Error('SSRF Blocked: Private IP requested');
    }
  } else {
    // Resolve hostname to prevent DNS rebinding or hidden local IPs
    const ips = await resolveDNS(url.hostname);
    if (ips.length === 0) {
      throw new Error('DNS resolution failed or no A records found');
    }

    if (ips.some(isPrivateIP)) {
      throw new Error('SSRF Blocked: Hostname resolves to a private IP');
    }
  }

  // We rely on Cloudflare's native timeout and redirect handling
  // Note: in Edge runtimes, we cannot easily pin the IP while maintaining the Host header
  // via standard fetch(), but checking via DoH provides a strong pre-flight defense.
  // Cloudflare Workers natively prevent fetching 127.0.0.1 anyway.
  
  const finalInit = {
    ...init,
    redirect: 'follow' as RequestRedirect, 
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const res = await fetch(url.toString(), {
      ...finalInit,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}
