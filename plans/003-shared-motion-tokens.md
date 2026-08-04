# Plan 003 — Shared easing/duration tokens

**Status:** TODO
**Commit stamped:** 028567b
**Severity:** MEDIUM
**Category:** Cohesion & tokens

## Problem

`tailwind.config.js` has no `transitionTimingFunction` or `transitionDuration` extensions — every component either falls back to Tailwind's default easing/duration or hardcodes its own. Confirmed instance:

`src/components/Sidebar.jsx`, line 102:

```jsx
        className={`w-64 bg-white border-r border-gray-200 fixed h-full flex flex-col z-40 print:hidden transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
```

`ease-in-out` here is Tailwind's built-in `cubic-bezier(0.4, 0, 0.2, 1)`, which per Emil Kowalski's rules is "too weak" — built-in CSS/Tailwind easings lack the punch of a custom curve. There's also no single source of truth other components can reuse, which is why Plan 001 and Plan 002 each had to reason about duration/easing independently.

## Target values

Add to `tailwind.config.js` under `theme.extend`:

```js
theme: {
  extend: {
    // ...existing fontFamily, colors...
    transitionTimingFunction: {
      'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',   // strong ease-out, for entrances/exits
      'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)', // strong ease-in-out, for on-screen movement (e.g. sidebar slide)
    },
    transitionDuration: {
      '160': '160ms',  // press feedback
      '200': '200ms',  // already a Tailwind default alias in v3, kept explicit for discoverability
    },
  },
},
```

These map directly to the values used elsewhere in this audit: `ease-out-strong` for modal entrances (Plan 001) and button press feedback (Plan 004), `ease-in-out-strong` for the sidebar's on-screen slide.

## Steps

1. Open `tailwind.config.js`, add the `transitionTimingFunction` and `transitionDuration` blocks above inside `theme.extend` (alongside the existing `fontFamily` and `colors` keys — do not remove or reorder those).
2. Update `src/components/Sidebar.jsx` line 102: change `ease-in-out` to `ease-in-out-strong` (the new token), keep `duration-200` as-is:
   ```
   transition-transform duration-200 ease-in-out-strong
   ```
3. If Plan 001 (modal entrance/exit) has already landed, update its `ease-out` Tailwind class references (`duration-200 ease-out` on the modal fade/scale) to `duration-200 ease-out-strong` for consistency. If Plan 001 has not landed yet, skip this sub-step — it is not blocking.
4. If Plan 004 (button press feedback) has already landed, update its `ease-out` reference the same way. If not landed yet, skip — not blocking.
5. Do not introduce a JS/CSS-variable-based token system (e.g. `--ease-out` custom properties) — this repo has no global CSS variable convention today (checked `index.css`, only `@tailwind` directives + `@layer components`), so stay inside Tailwind's config-based token system to match existing conventions.

## Scope boundaries

- `tailwind.config.js` and `src/components/Sidebar.jsx` are the only required changes.
- Updating Plans 001/004 to use the new token names is opportunistic cleanup, not required for this plan to be considered done — do not block on execution order.

## Verification

1. `npm run dev`, confirm the app builds with no Tailwind config errors.
2. Open the mobile sidebar (resize viewport below `lg` breakpoint or use DevTools device toolbar), toggle it open/closed, and confirm the slide-in/out still animates at 200ms — compare by eye against the pre-change behavior (should feel slightly snappier/more intentional due to the stronger curve, but not jarring).
3. Grep the codebase for `ease-in-out\b` and `ease-out\b` (excluding `-strong` suffixed ones) to confirm no other component was accidentally missed if this pattern should be applied more broadly in a future pass — report findings but do not fix them in this plan (out of scope).
