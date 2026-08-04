# Plan 006 — `prefers-reduced-motion` support

**Status:** TODO
**Commit stamped:** 028567b
**Severity:** LOW
**Category:** Accessibility

## Problem

No file in `src/` handles `prefers-reduced-motion` — confirmed via repo-wide grep for `prefers-reduced-motion` (zero matches). Motion in this app is currently minimal (a few `transition-colors`, the sidebar slide, spinners), but Plans 001, 004, and 005 in this audit each add new transform-based motion (modal scale-in, button press scale, backdrop fade). Per the accessibility standard, `prefers-reduced-motion: reduce` should replace movement/scale-based transitions with gentler opacity-only equivalents — not remove feedback entirely.

## Target approach

Add a single global CSS rule in `src/index.css` that blankets transform-based transitions for users who've opted into reduced motion, rather than hand-editing every component. This keeps the fix centralized and future-proof for motion added after this plan too.

## Steps

1. Open `src/index.css`. After the existing `@layer base` block (lines 5–9), add:

   ```css
   @media (prefers-reduced-motion: reduce) {
     *,
     *::before,
     *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```

   This is the standard "near-instant" blanket override — it doesn't remove `opacity` transitions' visual effect (they still happen, just instantly), and it neutralizes `animate-spin` loading spinners' perceived motion duration without hiding the loading state itself (the spinner element is still visually present, just not visibly rotating — which is an acceptable tradeoff; spinners are decorative-motion, not information-bearing).

2. This is intentionally a blanket rule rather than per-component `motion-reduce:` Tailwind variants, because: (a) it requires zero changes to Plans 001/004/005's component code regardless of execution order, and (b) this repo has no existing `prefers-reduced-motion` handling to build on incrementally.
3. Do not attempt a more nuanced "keep opacity, drop transform" implementation in this pass (which the standards prefer in principle) — that would require per-component `motion-reduce:` Tailwind classes on every transition added by Plans 001/004/005, which creates an ordering dependency this plan should not have. Flag this simplification in the PR/commit description as a known simplification, not a full implementation of the nuanced standard.

## Scope boundaries

- Single file: `src/index.css`.
- No component-level changes.
- No new dependencies.

## Verification

1. `npm run dev`.
2. In Chrome DevTools, open the Rendering tab (Cmd+Shift+P → "Show Rendering"), set "Emulate CSS media feature prefers-reduced-motion" to "reduce".
3. Reload the app, trigger the sidebar slide, a modal (if Plan 001 has landed), and a button press (if Plan 004 has landed) — confirm all transitions now resolve near-instantly instead of animating.
4. Turn the emulation back to "No emulation" and confirm all animations return to their normal durations — this rule must not affect users without the preference set.
5. Confirm `animate-spin` loading spinners (there are ~15 instances across the app, e.g. `App.jsx:29`, `Login.jsx:90`) don't cause a jarring frozen-mid-spin visual — since `animation-iteration-count: 1` with `0.01ms` duration effectively stops it after an imperceptible flash, this should look like a static spinner icon, which is acceptable.
