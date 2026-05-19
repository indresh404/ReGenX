# PR: Zero-Knowledge Audit Portal and Carbon Ledger

## Summary
- Add a public verification portal that reads/writes the audit registry in localStorage (`audit-registry`).
- Seed the registry with verified hashes for immediate auditor testing.
- Hook ESG PDF generation into the registry with SHA-256 length hashes.
- Add glassmorphic audit UI helpers and micro-animations.
- Expose Public Verification in the sidebar for all roles.

## Changes
- Audit portal module updates, registry helpers, and verification flow.
- ESG reporter updates for audit hash generation and registry persistence.
- Sidebar label updates across roles.
- New audit portal styles (spinner, fade-in-up, registry items).

## Testing
- Manual: Open Public Verification, copy a seed hash, and verify success.
- Manual: Generate an ESG PDF report and verify its hash in the portal.

## Checklist
- [x] UI verified across Provider, Rider, Plant.
- [x] No console errors in normal flow.
- [x] Responsive layout preserved.
