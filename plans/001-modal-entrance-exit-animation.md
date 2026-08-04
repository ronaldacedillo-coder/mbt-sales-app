# Plan 001 — Modal entrance/exit animation

**Status:** TODO
**Commit stamped:** 028567b
**Severity:** HIGH
**Category:** Physicality & origin

## Problem

Modal dialogs in this app appear and disappear with a hard cut — no backdrop fade, no scale/opacity transition on the dialog itself. Per Emil Kowalski's design engineering rules, elements should never appear/disappear instantly; entrances should come from `scale(0.9–0.97)` + `opacity: 0`, never `scale(0)`, and modals keep `transform-origin: center` (they are not anchored to a trigger).

Two confirmed instances:

### Instance A — `src/components/AboutModal.jsx` (whole file, lines 9–20)

Current code:

```jsx
export const AboutModal = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About RonApps"
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
```

### Instance B — `src/pages/itinerary/ItineraryForm.jsx`, `VisitEntryModal` component (lines 560–572)

Current code:

```jsx
  return (
    <div
      className="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit visit' : 'Add visit'}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
```

Both instances share the exact same backdrop + dialog wrapper markup pattern (`fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4` for the backdrop, `bg-white rounded-xl shadow-xl ... overflow-hidden` for the dialog).

## Target values

- Backdrop: fade in via `opacity`, 200ms, `ease-out`.
- Dialog: enter from `scale(0.95) opacity: 0` → `scale(1) opacity: 1`, 200ms, `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`). Keep `transform-origin: center` (default) — these are modals, not trigger-anchored popovers, so center origin is correct per the exemption rule.
- No exit animation is required for v1 (both modals unmount on close via conditional render) — scope is limited to the enter transition. If the executor wants to add an exit transition, it must use a library-free approach (e.g. local `closing` state + `onTransitionEnd`) — do NOT add a dependency for this.
- Stay under the sub-300ms UI budget (200ms qualifies, matches the "Modals, drawers: 200–500ms" band's lower bound, appropriate since this is a professional/crisp app, not playful).

## Steps

1. In `src/components/AboutModal.jsx`:
   - Add a CSS `@starting-style` block (Tailwind arbitrary values or a small inline `<style>`/CSS module — whichever matches how this codebase already handles one-off styles; note this repo uses **plain Tailwind utility classes with no CSS-in-JS**, so prefer Tailwind's `data-[state=]` + a tiny local CSS rule, OR the simplest correct fix: use a `mounted` state flag + `useEffect` to toggle classes, since `@starting-style` browser support should be verified against this app's target browsers first — if uncertain, use the `mounted` state fallback pattern below).
   - Fallback pattern (safe, works everywhere):
     ```jsx
     import { useEffect, useState } from 'react'

     export const AboutModal = ({ onClose }) => {
       const [mounted, setMounted] = useState(false)
       useEffect(() => { setMounted(true) }, [])

       return (
         <div
           className={`fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`}
           onClick={onClose}
           aria-hidden="true"
         >
           <div
             role="dialog"
             aria-modal="true"
             aria-label="About RonApps"
             className={`bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transition-all duration-200 ease-out ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
             onClick={(e) => e.stopPropagation()}
           >
     ```
   - Note: `transition-all` is used here intentionally because both `opacity` and `transform` are animating together on the dialog — this is the one place `transition-all` is acceptable since both properties are GPU-safe (`transform`, `opacity`). Do not use `transition-all` elsewhere (see Plan 002).
2. Apply the identical `mounted` pattern to `VisitEntryModal` in `src/pages/itinerary/ItineraryForm.jsx` (lines 556–572), keeping its existing `max-w-lg` dialog width and all other classes unchanged.
3. Do not touch any other modal-shaped UI outside these two files in this plan (e.g. do not build a shared `Modal` component — that's a separate, larger refactor noted in the audit as a missed opportunity, out of scope here).

## Scope boundaries

- Only `src/components/AboutModal.jsx` and `src/pages/itinerary/ItineraryForm.jsx` (the `VisitEntryModal` sub-component only) change.
- No new npm dependencies.
- No change to modal open/close logic, only to the visual transition.

## Verification

1. `npm run dev`, open the app, trigger the About modal (find its trigger in `Navbar.jsx` or wherever it's invoked) and the itinerary "Add Visit" / "Edit Visit" modal.
2. Confirm both now fade + scale in over ~200ms instead of snapping into place.
3. Feel-check in slow motion: open Chrome DevTools → Rendering → enable "Emulate CSS media feature prefers-reduced-motion" off, then use the Animations panel to slow playback 4x and confirm the scale settles smoothly with no jump/flash.
4. Confirm closing still works instantly (no exit animation is in scope — clicking backdrop or Close should close immediately, matching current behavior).
5. Confirm no console errors and the dialog is still keyboard/click accessible (Escape/backdrop click still close it, if that behavior existed before).
