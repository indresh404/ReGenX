# PR: Dispatch SLA Monitor & Delay Risk Radar

## Summary
- Add a persistent SLA ledger (`sla-ledger`) for dispatch timing.
- Track pickup and completion timestamps automatically.
- Add SLA Monitor view and navigation across roles.
- Add SLA widgets to dashboards.

## Changes
- Add SLA ledger helpers and view rendering in `app.js`.
- Add SLA monitor styles in `styles.css`.
- Add new issue spec in `ISSUE-15.md`.

## Testing
- Manual: Create a dispatch, accept and complete it, then check SLA Monitor.
- Manual: Verify SLA widget updates after completion.

## Checklist
- [x] UI verified across Provider, Rider, Plant.
- [x] No console errors in normal flow.
- [x] Responsive layout preserved.
