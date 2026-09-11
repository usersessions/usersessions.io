# @usersessions/capture

MIT licensed. Self-hostable.

The first-party session capture library used by UserSessions.io.
The production build lives in `src/dashboard/public/capture.js`.

## What it does

- Loads rrweb only on sessions that qualify (≥1 rage click or ≥1 JS error detected client-side)
- Sends qualified event streams to `/api/ingest/replay` (R2 storage)
- Sends heatmap click events to `/api/ingest/heatmap` (Postgres JSONB)
- SRI-pinned rrweb load to prevent supply-chain attacks
- Caps upload at 5,000 events and 5 MB per session

## Self-hosting

Point `CAPTURE_INGEST_URL` at your own dashboard deployment:

```html
<script>
  window.US_CONFIG = {
    key: "your_capture_public_key",
    ingestUrl: "https://your-domain.com/api/ingest"
  };
</script>
<script src="https://your-domain.com/capture.js" async></script>
```

## License

MIT — see root LICENSE file.
