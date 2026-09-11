-- seed.sql — launch wedge: AI tool indexes + startup launch platforms ONLY (BUILD_SPEC §1).
-- Idempotent. editorial_score is a labeled estimate until the nightly Platform Quality Score cron (M10) computes the real value.
-- RULE: a platform row may only be active=true once its adapter passes M6 gates. All rows ship inactive;
-- flipping active=true is part of each adapter's definition of done.

insert into platforms (id, name, category, editorial_score, tier_required, active) values
  -- AI tool indexes
  ('theresanaiforthat', 'There''s An AI For That', 'ai', 80, 'free',    true),
  ('futurepedia',       'Futurepedia',             'ai', 78, 'free',    true),
  ('futuretools',       'FutureTools',             'ai', 75, 'founder', false),
  ('toolify',           'Toolify',                 'ai', 72, 'founder', false),
  ('aitoolsdirectory',  'AI Tools Directory',      'ai', 60, 'free',    false),
  ('topai',             'TopAI.tools',             'ai', 55, 'free',    false),
  ('aitoolhunt',        'AI Tool Hunt',            'ai', 52, 'free',    false),
  -- Startup launch platforms
  ('producthunt',       'Product Hunt',            'startup', 90, 'free',    false),
  ('betalist',          'BetaList',                'startup', 75, 'founder', false),
  ('indiehackers',      'Indie Hackers',           'startup', 70, 'free',    false),
  ('microlaunch',       'MicroLaunch',             'startup', 65, 'free',    false),
  ('uneed',             'Uneed',                   'startup', 62, 'free',    true),
  ('startupbase',       'StartupBase',             'startup', 50, 'free',    false),
  ('betapage',          'BetaPage',                'startup', 48, 'founder', false),
  ('launchingnext',     'Launching Next',          'startup', 45, 'founder', false)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  editorial_score = excluded.editorial_score,
  tier_required = excluded.tier_required;

insert into feature_flags (flag_name, enabled) values
  ('pricing_page', true),
  ('billing', true)
on conflict (flag_name) do nothing;
