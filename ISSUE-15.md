# 🚨 [CRITICAL] Issue #15: Dispatch SLA Monitor & Delay Risk Radar

Introduce a real-time SLA monitor that tracks pickup/processing timelines and highlights delay risks across all roles.

---

## 🎯 Objective
- Create a persistent **SLA Ledger** (`localStorage: sla-ledger`).
- Track dispatch lifecycle timing (created, pickup, completion).
- Provide an **SLA Monitor** view with breach indicators.
- Add a **SLA Widget** to Provider/Rider/Plant dashboards.

---

## ✅ Core Requirements
- **Ledger Schema**
  - `{ id, orderId, org, createdTs, targetMins, status, pickupTs, completeTs, deltaMins, breach }`
- **SLA Target**
  - 90 minutes from request to completion
- **Breach Rules**
  - Live risk if elapsed > target while in progress
  - Final breach if completed beyond target

---

## 🧠 Proposed Modules
- `src/app.js` — SLA ledger helpers, view rendering, lifecycle updates
- `src/styles.css` — SLA cards and status UI

---

## ✅ Quality Standards (Exceptional)
- Full **JSDoc** on new helpers
- Zero console errors
- Responsive layout across roles
- Glassmorphism + micro-animations

---

## ✅ Acceptance Criteria
- SLA entries created on dispatch request.
- SLA monitor view and widget visible for all roles.
- Breach status updates based on real elapsed time.
