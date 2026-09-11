-- ============================================================
-- First-party (capture.js) ingestion + patch URL targeting
--
-- Fixes (CODEBASE_AUDIT.md §2.1, §2.2, §2.4):
--   * us_sessions.source CHECK did not allow a first-party value, so every
--     heatmap upsert failed and the replay route mislabelled rows as 'posthog'.
--   * scroll_depth_pct was sent by capture.js but had no column.
--   * us_ui_patches had no url_pattern, so patches applied site-wide.
-- ============================================================

-- ── us_sessions ------------------------------------------------
ALTER TABLE us_sessions DROP CONSTRAINT IF EXISTS us_sessions_source_check;
ALTER TABLE us_sessions ADD CONSTRAINT us_sessions_source_check
  CHECK (source IN ('datadog_rum','posthog','fullstory','logrocket','hotjar','first_party'));

ALTER TABLE us_sessions
  ADD COLUMN IF NOT EXISTS scroll_depth_pct integer CHECK (scroll_depth_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS page_url         text;

COMMENT ON COLUMN us_sessions.scroll_depth_pct IS 'Max scroll depth reported by capture.js (0-100). NULL for third-party sources.';
COMMENT ON COLUMN us_sessions.page_url        IS 'Last pathname reported by capture.js. Used to scope UI patches and heatmaps.';

-- Rows written by /api/ingest/replay before this migration were labelled 'posthog'
-- with source_session_id = our own UUID. Real PostHog sessions carry PostHog ids.
UPDATE us_sessions
   SET source = 'first_party'
 WHERE source = 'posthog'
   AND source_session_id = id::text;

-- Cron pickup of qualifying first-party sessions
CREATE INDEX IF NOT EXISTS us_sessions_first_party_signal_idx
  ON us_sessions (ingested_at DESC)
  WHERE source = 'first_party' AND (error_count > 0 OR rage_click_count > 0);

-- ── us_ui_patches ----------------------------------------------
ALTER TABLE us_ui_patches
  ADD COLUMN IF NOT EXISTS url_pattern    text,
  ADD COLUMN IF NOT EXISTS target_signals jsonb;  -- idempotent with 20260904000000

COMMENT ON COLUMN us_ui_patches.url_pattern IS 'Pathname pattern the patch applies to. NULL = whole site. ''*'' is a wildcard, e.g. /docs/*';
