# Plan 004 — Button press (`:active`) feedback

**Status:** TODO
**Commit stamped:** 028567b
**Severity:** LOW (missed opportunity, high relevance for this app)
**Category:** Missed opportunity / feedback

## Problem

`src/index.css`, lines 11–20:

```css
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm;
  }
  .btn-secondary {
    @apply px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm;
  }
  .btn-danger {
    @apply px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm;
  }
}
```

These three shared button classes are used throughout the app for primary actions — including Approve/Reject/Submit/Delete flows (`FCRApproval.jsx`, `ItineraryApproval.jsx`, form submit buttons, etc.). None of them have `:active` press feedback. Per Emil Kowalski's rules: "Buttons must feel responsive to press — add `transform: scale(0.97)` on `:active`. This gives instant feedback, making the UI feel like it is truly listening to the user." This matters more than average here because this app is approval/decision-heavy — users need confidence their click registered before a network request resolves.

## Target values

- `active:scale-[0.97]` (Tailwind arbitrary value, since Tailwind's default scale steps don't include 97%)
- `transition-transform duration-160 ease-out` — 160ms sits inside the "Button press feedback: 100–160ms" budget from the standards.
- If Plan 003 has landed, use `ease-out-strong` instead of `ease-out`. If not landed, use Tailwind's built-in `ease-out` — do not block on Plan 003.

## Steps

1. Open `src/index.css`.
2. Update each of the three button classes to add the transform transition and active-state scale. Since `transition-colors` and a `transform`-based transition target different properties, add a second `transition` utility (Tailwind supports combining `transition-colors` with an explicit `transition-transform`) or switch to listing properties explicitly. Simplest correct approach — use `transition-[color,background-color,transform]` is verbose; instead keep `transition-colors` for the color change and add a **separate** `transition-transform duration-160 ease-out` utility class, since Tailwind lets you apply multiple `transition-*` utilities and the browser will animate whichever properties actually change:

   ```css
   @layer components {
     .btn-primary {
       @apply px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:scale-[0.97] transition-colors transition-transform duration-160 ease-out font-medium text-sm;
     }
     .btn-secondary {
       @apply px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-[0.97] transition-colors transition-transform duration-160 ease-out font-medium text-sm;
     }
     .btn-danger {
       @apply px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.97] transition-colors transition-transform duration-160 ease-out font-medium text-sm;
     }
   }
   ```

   Note: Tailwind's `@apply` will merge these into a single `transition-property` declaration correctly since `transition-colors` and `transition-transform` both compile to `transition-property` values that get combined — verify this compiles without one silently overriding the other (see verification step 3). If they conflict, fall back to a single explicit utility: `transition-[background-color,transform]`.

3. Do not modify any other classes in `index.css`, and do not touch individual components — the goal is that every consumer of `.btn-primary`/`.btn-secondary`/`.btn-danger` gets this for free.

## Scope boundaries

- Single file: `src/index.css`.
- Do not add press feedback to non-button interactive elements (links, table rows, etc.) in this plan — that's a separate, broader sweep.
- Do not change hover colors, padding, or any other existing button styling.

## Verification

1. `npm run dev`, find any page using `.btn-primary`/`.btn-secondary`/`.btn-danger` (e.g. `AccountForm.jsx`, `FCRApproval.jsx`, `Login.jsx`).
2. Click and hold a button, confirm it visibly scales down slightly (~3%) and springs back on release.
3. Inspect the computed `transition-property` in DevTools on one of the buttons to confirm both `background-color` and `transform` are listed (not one overwriting the other via `@apply` ordering).
4. Confirm this doesn't break any button that's inside a `flex`/`grid` layout — a scale transform on `:active` should not cause layout shift (it's a `transform`, not a `width`/`height` change, so it shouldn't, but visually confirm no neighboring elements jump).
5. Spot-check on the Login page's submit button (`Login.jsx:90` area) and an Approve button in `FCRApproval.jsx` — these are the highest-stakes click targets in the app.
