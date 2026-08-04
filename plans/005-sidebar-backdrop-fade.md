# Plan 005 — Sidebar mobile backdrop fade

**Status:** TODO
**Commit stamped:** 028567b
**Severity:** LOW
**Category:** Missed opportunity / spatial consistency

## Problem

`src/components/Sidebar.jsx`, lines 90–104:

```jsx
  return (
    <>
      {/* Backdrop -- mobile/tablet only, closes the drawer on tap */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/40 z-30 lg:hidden print:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 bg-white border-r border-gray-200 fixed h-full flex flex-col z-40 print:hidden transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
```

The `<aside>` drawer slides in/out smoothly over 200ms (`transition-transform`), but the backdrop is conditionally rendered (`{isOpen && (...)}`) with no transition at all — it's either fully present or fully absent, popping in/out instantly while the drawer next to it animates. This breaks spatial consistency: two elements that appear together should move together.

## Target values

- Backdrop fades via `opacity`, 200ms, matching the drawer's existing duration exactly so they feel like one coordinated motion (per the Sonner cohesion principle: "the whole experience is cohesive").
- Use the same easing as the drawer for consistency — `ease-in-out` (or `ease-in-out-strong` if Plan 003 has already landed).

## Steps

1. The backdrop currently unmounts entirely when `isOpen` is `false` (via `{isOpen && (...)}`), which makes a CSS transition on it impossible — an element with `display: none`/unmounted can't transition. Switch to always rendering the backdrop and toggling opacity + `pointer-events` instead:

   ```jsx
   {/* Backdrop -- mobile/tablet only, closes the drawer on tap */}
   <div
     className={`fixed inset-0 bg-gray-900/40 z-30 lg:hidden print:hidden transition-opacity duration-200 ease-in-out ${
       isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
     }`}
     onClick={onClose}
     aria-hidden="true"
   />
   ```

   The `pointer-events-none`/`pointer-events-auto` toggle is required so the invisible backdrop doesn't block clicks on the page underneath when closed (replacing the unmount-based "not there" behavior).

2. Leave the `<aside>` drawer element and its existing `transition-transform duration-200 ease-in-out` untouched — only the backdrop changes.
3. If Plan 003 has landed, use `ease-in-out-strong` for both the backdrop and (per Plan 003 step 2) the drawer, so they stay in sync. If Plan 003 has not landed, leave both as `ease-in-out` — do not mix strong/weak easing between the two elements, they must match.

## Scope boundaries

- Single file: `src/components/Sidebar.jsx`.
- Do not change the drawer's own slide animation, width, or breakpoint behavior (`lg:hidden`, `lg:translate-x-0`).

## Verification

1. `npm run dev`, resize the viewport below the `lg` breakpoint (or use DevTools device toolbar) to trigger the mobile sidebar.
2. Open the sidebar (via whatever triggers `onOpen`/`isOpen=true` — check `Navbar.jsx`'s menu button), confirm the backdrop now fades in alongside the drawer sliding in, over the same ~200ms.
3. Close it, confirm the backdrop fades out in sync with the drawer sliding out.
4. Confirm that when the sidebar is closed, clicking where the backdrop used to be does NOT block clicks on underlying page content (test by clicking a button/link on the page behind where the backdrop sits) — this verifies the `pointer-events-none` toggle worked.
5. Confirm no layout shift or flash-of-backdrop on initial page load (the backdrop should start at `opacity-0` since `isOpen` presumably defaults to `false` on desktop-first load — check the parent component's initial state for `isOpen`).
