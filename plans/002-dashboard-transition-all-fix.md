# Plan 002 — Fix `transition-all` on Dashboard QuickActionCard

**Status:** TODO
**Commit stamped:** 028567b
**Severity:** MEDIUM
**Category:** Performance

## Problem

`src/pages/Dashboard.jsx`, `QuickActionCard` component (line 561):

```jsx
const QuickActionCard = ({ icon: Icon, label, description, link, color }) => {
  const colors = {
    blue: 'hover:border-blue-300 hover:bg-blue-50',
    emerald: 'hover:border-emerald-300 hover:bg-emerald-50',
    amber: 'hover:border-amber-300 hover:bg-amber-50',
    purple: 'hover:border-purple-300 hover:bg-purple-50',
  }

  return (
    <Link 
      to={link}
      className={`flex items-center gap-3 p-4 border border-gray-200 rounded-xl transition-all ${colors[color]}`}
    >
```

Only `border-color` and `background-color` change on hover (per the `colors` map). `transition-all` animates every animatable CSS property on the element, which is unbounded and can pick up unintended property changes (and is flagged as an anti-pattern per the review checklist: "`transition: all` → Specify exact properties").

## Target value

Replace `transition-all` with `transition-colors` — Tailwind's `transition-colors` utility scopes the transition to `background-color`, `border-color`, `color`, `fill`, `stroke`, which is exactly what's changing here. Keep the default Tailwind duration (150ms) since this is a frequent hover target (dashboard quick-action cards are seen many times per session) — no need to slow it down.

## Steps

1. Open `src/pages/Dashboard.jsx`, locate the `QuickActionCard` component (around line 550–570).
2. On line 561, change:
   ```
   className={`flex items-center gap-3 p-4 border border-gray-200 rounded-xl transition-all ${colors[color]}`}
   ```
   to:
   ```
   className={`flex items-center gap-3 p-4 border border-gray-200 rounded-xl transition-colors ${colors[color]}`}
   ```
3. Do not change anything else in this component or file.

## Scope boundaries

- Single-line change, single file (`src/pages/Dashboard.jsx`).
- No visual behavior change intended — hover still animates border + background color, just without the unbounded property scope.

## Verification

1. `npm run dev`, go to the Dashboard, hover each of the four quick-action cards (blue/emerald/amber/purple variants).
2. Confirm the border-color and background-color still transition smoothly on hover (should look identical to before — this is a performance/scope cleanup, not a visual change).
3. Open Chrome DevTools → Rendering → "Paint flashing" or the Performance panel, hover a card, and confirm no unexpected properties (e.g. box-shadow, layout) are being recalculated — the changed-property set should now be exactly `background-color, border-color`.
