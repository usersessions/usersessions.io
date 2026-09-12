/**
 * UserSessions.io First-Party Capture & Patching Script (v4.1)
 *
 * v4.1 changes:
 *  - Counters (rage clicks, JS errors) are cumulative per session so server upserts are idempotent
 *  - JS error details (message/source/line, capped) are sent with heatmap flushes
 *  - Scroll depth no longer triggers rrweb (it fired on nearly every long page); still reported
 *  - Patch invalidation beacons go to the configured endpoint, not a hardcoded host
 *  - Attribute patches restricted to an allow-list; javascript:/data: URLs rejected
 *  - Candidate cap in patch matching to avoid thrash on virtualized lists
 *
 * Embed:
 *   <script async src="https://usersessions.io/capture.js"
 *           data-client-key="YOUR_PUBLIC_KEY"></script>
 */
(function () {
  if (typeof window === 'undefined' || window.UserSessions) return;

  // ── Config ────────────────────────────────────────────────────────────────────
  const HEATMAP_ENDPOINT    = window.UserSessionsEndpoint           || 'https://usersessions.io/api/ingest/heatmap';
  const REPLAY_ENDPOINT     = window.UserSessionsReplayEndpoint     || 'https://usersessions.io/api/ingest/replay';
  const PATCH_ENDPOINT      = window.UserSessionsPatchEndpoint      || 'https://usersessions.io/api/patches/active';
  const INVALIDATE_ENDPOINT = window.UserSessionsInvalidateEndpoint || PATCH_ENDPOINT.replace(/\/active\/?$/, '/invalidate');
  const RRWEB_CDN           = window.UserSessionsRrwebUrl           || 'https://cdn.jsdelivr.net/npm/rrweb@2/dist/rrweb.umd.cjs';

  const clientKey = (
    document.currentScript?.getAttribute('data-client-key') ||
    document.currentScript?.getAttribute('data-client-id') ||
    window.UserSessionsClientId
  );

  if (!clientKey) {
    console.warn('[UserSessions] Missing data-client-key attribute.');
    return;
  }

  // ── Session ID (tab-scoped, no cookies) ──────────────────────────────────────
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function makeUuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    // RFC4122 v4 fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  let sessionId = sessionStorage.getItem('us_sid');
  if (!sessionId || !UUID_RE.test(sessionId)) {
    sessionId = makeUuid();
    sessionStorage.setItem('us_sid', sessionId);
  }

  // ── Privacy / exclusions ─────────────────────────────────────────────────────
  const EXCLUDED_ROUTES = /(checkout|payment|billing|login|auth|account|settings|signup)/i;
  const isPatchingAllowed = !EXCLUDED_ROUTES.test(window.location.pathname);
  const PII_REGEX = /ssn|social|password|email|credit|card|cvv|phone|dob|birth/i;

  function shouldMask(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hasAttribute('data-us-unmask')) return false;
    if (el.hasAttribute('data-us-mask')) return true;
    const tag = el.tagName.toLowerCase();
    const type = el.getAttribute('type');
    const name = el.getAttribute('name') || '';
    const id   = el.id || '';
    if (tag === 'input' && (type === 'password' || type === 'email' || type === 'tel')) return true;
    if (PII_REGEX.test(name) || PII_REGEX.test(id)) return true;
    return false;
  }

  function getElementPath(el) {
    if (!el || el.nodeType !== 1) return '';
    const path = [];
    while (el && el.nodeType === 1) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) { selector += '#' + el.id; path.unshift(selector); break; }
      let sib = el, nth = 1;
      while ((sib = sib.previousElementSibling)) {
        if (sib.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  // ── State ─────────────────────────────────────────────────────────────────────
  const MAX_ERRORS_PER_FLUSH = 10;
  const state = {
    clicks: [],
    mouseMoves: [],
    maxScrollDepth: 0,
    rageClicks: [],      // since last flush
    errors: [],          // since last flush (details)
    totals: { rageClicks: 0, jsErrors: 0 },  // cumulative for the session
    lastClickTime: 0,
    clickCount: 0,
    lastClickTarget: null,
    appliedPatches: [],
    patchMetrics: {},
    moTimer: null,
    // rrweb
    rrwebEvents: [],
    rrwebStopFn: null,
    rrwebLoaded: false,
    sessionQualified: false,
    replayFlushed: false,
  };

  const RAGE_THRESHOLD_MS = 500;
  const RAGE_COUNT        = 3;

  // ── Qualifying check ──────────────────────────────────────────────────────────
  // Scroll depth is deliberately NOT a trigger: it fires on almost every long page
  // before the visitor has scrolled, and rrweb cannot record retroactively anyway.
  function checkQualification() {
    if (state.sessionQualified) return;
    if (state.totals.rageClicks >= RAGE_COUNT || state.totals.jsErrors > 0) {
      state.sessionQualified = true;
      loadRrweb();
    }
  }

  // ── Load rrweb on demand ─────────────────────────────────────────────────────
  function loadRrweb() {
    if (state.rrwebLoaded || document.querySelector('script[data-us-rrweb]')) return;
    const s = document.createElement('script');
    s.src = RRWEB_CDN;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-us-rrweb', '1');
    s.onload = startRrweb;
    document.head.appendChild(s);
  }

  function startRrweb() {
    if (!window.rrweb || state.rrwebStopFn) return;
    state.rrwebLoaded = true;
    state.rrwebStopFn = window.rrweb.record({
      emit(event) {
        state.rrwebEvents.push(event);
        if (state.rrwebEvents.length > 5000) state.rrwebEvents.shift();
      },
      maskAllInputs: true,
      maskInputOptions: { password: true, email: true, tel: true },
      blockSelector: '[data-us-mask]',
    });
    console.debug('[UserSessions] rrweb recording started for session', sessionId);
  }

  // ── Event listeners ───────────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const target = e.target;
    const now    = Date.now();
    const path   = getElementPath(target);

    if (target === state.lastClickTarget && (now - state.lastClickTime) < RAGE_THRESHOLD_MS) {
      state.clickCount++;
      if (state.clickCount >= RAGE_COUNT) {
        state.rageClicks.push({ x: e.clientX, y: e.clientY, path, time: now });
        state.totals.rageClicks++;
        for (const id of state.appliedPatches) {
          if (state.patchMetrics[id]) state.patchMetrics[id].rageClicks++;
        }
        checkQualification();
        state.clickCount = 0;
      }
    } else {
      state.clickCount = 1;
      state.lastClickTarget = target;
    }
    state.lastClickTime = now;
    state.clicks.push({ x: e.clientX, y: e.clientY, path, masked: shouldMask(target), time: now });
  }, { capture: true, passive: true });

  function recordError(message, source, line) {
    state.totals.jsErrors++;
    if (!state.patchMetrics['global']) state.patchMetrics['global'] = { jsErrors: 0 };
    state.patchMetrics['global'].jsErrors++;
    for (const id of state.appliedPatches) {
      if (state.patchMetrics[id]) state.patchMetrics[id].jsErrors++;
    }
    if (state.errors.length < MAX_ERRORS_PER_FLUSH) {
      state.errors.push({
        message: String(message || 'Unknown error').slice(0, 300),
        source:  typeof source === 'string' ? source.slice(0, 300) : null,
        line:    typeof line === 'number' ? line : null,
        time:    Date.now(),
      });
    }
    checkQualification();
  }

  window.addEventListener('error', (e) => {
    recordError(e && e.message, e && e.filename, e && e.lineno);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    recordError(r && (r.message || String(r)), null, null);
  });

  let scrollTimer;
  document.addEventListener('scroll', () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      const depth = window.scrollY + window.innerHeight;
      const total = Math.max(1, document.body.scrollHeight);
      const pct = Math.min(100, Math.round((depth / total) * 100));
      if (pct > state.maxScrollDepth) state.maxScrollDepth = pct;
      scrollTimer = null;
    }, 1000);
  }, { passive: true });

  let moveTimer;
  document.addEventListener('mousemove', (e) => {
    if (moveTimer) return;
    moveTimer = setTimeout(() => {
      state.mouseMoves.push({ x: e.clientX, y: e.clientY, time: Date.now() });
      moveTimer = null;
    }, 500);
  }, { passive: true });

  // ── Patching (Selector Resilience & SPA Support) ─────────────────────────────
  // Mirrors lib/patches/validate.ts. The server is the source of truth; this is defence in depth.
  const SAFE_ATTRIBUTES = new Set([
    'href', 'title', 'alt', 'placeholder', 'aria-label', 'aria-hidden', 'aria-disabled',
    'aria-describedby', 'disabled', 'role', 'tabindex', 'type', 'value', 'target', 'rel',
  ]);
  const DANGEROUS_URL = /^\s*(javascript|data|vbscript|file|blob):/i;
  const MAX_CANDIDATES = 200;
  const MATCH_THRESHOLD = 30;

  let activePatches = [];
  const patchFailures = {};

  function scoreElement(el, signals) {
    if (!el || !signals) return 0;
    let score = 0;
    if (signals.text && (el.textContent || '').trim().includes(signals.text)) score += 40;
    if (signals.ariaLabel && el.getAttribute('aria-label') === signals.ariaLabel) score += 30;
    if (signals.dataTestId && el.getAttribute('data-testid') === signals.dataTestId) score += 30;
    if (signals.path && getElementPath(el) === signals.path) score += 20;
    if (signals.selector) { try { if (el.matches(signals.selector)) score += 10; } catch (e) {} }
    // Selector-only patches (no rich signals) match on the selector alone
    if (score === 10 && !signals.text && !signals.ariaLabel && !signals.dataTestId && !signals.path) return 50;
    return score;
  }

  function applyPatch(el, patch) {
    const p = patch.patch_payload || {};
    switch (patch.patch_type) {
      case 'css':
        if (p.styles && typeof p.styles === 'object') Object.assign(el.style, p.styles);
        return true;
      case 'text':
        if (typeof p.text === 'string') { el.textContent = p.text; return true; }
        return false;
      case 'attribute': {
        const attr = String(p.attr || '').toLowerCase();
        if (!SAFE_ATTRIBUTES.has(attr)) return false;
        if (p.action === 'remove') { el.removeAttribute(attr); return true; }
        const val = String(p.val ?? '');
        if (attr === 'href' && DANGEROUS_URL.test(val)) return false;
        el.setAttribute(attr, val);
        return true;
      }
      case 'redirect':
        if (el.tagName.toLowerCase() === 'a' && typeof p.href === 'string' && !DANGEROUS_URL.test(p.href)) {
          el.href = p.href;
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  function reApplyPatches() {
    if (!activePatches.length) return;
    activePatches.forEach(patch => {
      const signals = patch.target_signals || { selector: patch.target_selector };

      let candidates = [];
      try {
        if (signals.selector) candidates = Array.from(document.querySelectorAll(signals.selector));
        else if (signals.dataTestId) candidates = Array.from(document.querySelectorAll('[data-testid="' + signals.dataTestId.replace(/"/g, '\\"') + '"]'));
      } catch (e) {}
      if (candidates.length > MAX_CANDIDATES) candidates = candidates.slice(0, MAX_CANDIDATES);

      let bestEl = null;
      let maxScore = 0;
      for (const el of candidates) {
        const s = scoreElement(el, signals);
        if (s > maxScore) { maxScore = s; bestEl = el; }
      }

      if (!bestEl || maxScore < MATCH_THRESHOLD) {
        patchFailures[patch.id] = (patchFailures[patch.id] || 0) + 1;
        if (patchFailures[patch.id] >= 3) {
          // Self-invalidation: stale patch
          const url = INVALIDATE_ENDPOINT + '?patchId=' + encodeURIComponent(patch.id) + '&clientId=' + encodeURIComponent(clientKey);
          if (navigator.sendBeacon) navigator.sendBeacon(url);
          else fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
          activePatches = activePatches.filter(p => p.id !== patch.id);
        }
        return;
      }

      patchFailures[patch.id] = 0;
      const marker = 'data-us-patched-' + patch.id;
      if (bestEl.hasAttribute(marker)) return;

      try {
        if (applyPatch(bestEl, patch)) {
          bestEl.setAttribute(marker, '1');
          if (!state.appliedPatches.includes(patch.id)) {
            state.appliedPatches.push(patch.id);
            state.patchMetrics[patch.id] = { jsErrors: 0, rageClicks: 0 };
          }
        }
      } catch (e) {
        console.warn('[UserSessions] Patch failed:', patch.id, e);
      }
    });
  }

  let fetchController = null;
  function fetchPatches() {
    if (!isPatchingAllowed) return;
    if (fetchController) fetchController.abort();
    fetchController = new AbortController();
    fetch(PATCH_ENDPOINT + '?clientId=' + encodeURIComponent(clientKey) + '&url=' + encodeURIComponent(window.location.pathname) + '&sessionId=' + sessionId, { signal: fetchController.signal })
      .then(r => r.json())
      .then(res => {
        activePatches = Array.isArray(res.patches) ? res.patches : [];
        reApplyPatches();
      })
      .catch(() => {});
  }

  // SPA hooks & MutationObserver
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  history.pushState = function () { const r = originalPush.apply(this, arguments); fetchPatches(); return r; };
  history.replaceState = function () { const r = originalReplace.apply(this, arguments); fetchPatches(); return r; };
  window.addEventListener('popstate', fetchPatches);

  const mo = new MutationObserver(() => {
    clearTimeout(state.moTimer);
    state.moTimer = setTimeout(reApplyPatches, 300);
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { childList: true, subtree: true }));

  fetchPatches();

  // ── Heatmap flush (lightweight, always) ─────────────────────────────────────────────
  function flushHeatmap() {
    if (!state.clicks.length && !state.mouseMoves.length && !state.maxScrollDepth && !state.errors.length && !state.rageClicks.length) return;

    const payload = {
      clientId: clientKey,
      sessionId,
      url: window.location.pathname,
      viewport: window.innerWidth > 1024 ? 'desktop' : window.innerWidth > 768 ? 'tablet' : 'mobile',
      data: {
        clicks:         state.clicks.slice(),
        mouseMoves:     state.mouseMoves.slice(),
        maxScrollDepth: state.maxScrollDepth,
        rageClicks:     state.rageClicks.slice(),
        errors:         state.errors.slice(),
        totals:         { rageClicks: state.totals.rageClicks, jsErrors: state.totals.jsErrors },
        appliedPatches: state.appliedPatches,
        patchMetrics:   state.patchMetrics,
      },
    };

    const body = JSON.stringify(payload);
    const sent = navigator.sendBeacon ? navigator.sendBeacon(HEATMAP_ENDPOINT, body) : false;

    if (!sent) {
      fetch(HEATMAP_ENDPOINT, {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }

    state.clicks = [];
    state.mouseMoves = [];
    state.rageClicks = [];
    state.errors = [];
  }

  // ── Replay flush (qualifying sessions only) ────────────────────────────────────────
  function flushReplay() {
    if (!state.sessionQualified || state.replayFlushed) return;
    if (!state.rrwebEvents.length) return;

    state.replayFlushed = true;

    const payload = {
      session_id:       sessionId,
      client_key:       clientKey,
      events:           state.rrwebEvents.slice(),
      rage_click_count: state.totals.rageClicks,
      js_error_count:   state.totals.jsErrors,
      scroll_depth_pct: state.maxScrollDepth,
    };

    // keepalive fetch: sendBeacon has a 64 KB limit and rrweb payloads are large
    fetch(REPLAY_ENDPOINT, {
      method:    'POST',
      body:      JSON.stringify(payload),
      keepalive: true,
      headers:   { 'Content-Type': 'application/json' },
    }).catch(() => {});
  }

  // ── Flush schedule ────────────────────────────────────────────────────────────
  setInterval(flushHeatmap, 15000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushHeatmap();
      flushReplay();
    }
  });

  window.addEventListener('pagehide', () => {
    flushHeatmap();
    flushReplay();
  });

  // ── Public API ────────────────────────────────────────────────────────────────
  window.UserSessions = {
    flush:        flushHeatmap,
    flushReplay,
    getSessionId: () => sessionId,
    qualify:      () => { state.sessionQualified = true; loadRrweb(); },
  };

})();
