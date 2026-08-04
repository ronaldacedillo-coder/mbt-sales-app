# Plan 007 — Replace native `alert`/`confirm`/`prompt` with Sonner + base-ui

**Status:** TODO
**Commit stamped:** 028567b (may drift — re-verify line numbers before executing, several files have shifted since Plans 001-006 landed)
**Severity:** N/A (library/UX gap, surfaced via `pick-ui-library`, not a `review-animations`/`improve-animations` finding)
**Category:** Missing component library — no toast system, dialogs are unstyled browser natives with zero animation control

## Problem

This app has no toast library and no dialog primitive — every confirmation, validation message, and error is a native browser `alert()`/`confirm()`/`prompt()`. These block the main thread, can't be styled or animated, and are jarring in an approval-heavy internal tool. Per `pick-ui-library`'s curated list: **Sonner** is the pick for toasts, **base-ui** is the pick for accessible unstyled dialogs (including the `AlertDialog` sub-component, which is exactly a `confirm()` replacement).

Confirmed via repo-wide grep — **23 call sites across 9 files**:

### `alert()` — 16 call sites (all become `toast.error()` or `toast.success()` depending on context)

| File:Line | Current call | Context |
| --- | --- | --- |
| `FCRApproval.jsx:98` | `alert('This FCR can\'t be approved yet -- the account hasn\'t acknowledged the meeting minutes.')` | Validation guard before approve |
| `FCRApproval.jsx:115` | `alert('Failed to approve FCR')` | Error handler |
| `FCRApproval.jsx:139` | `alert('Failed to reject FCR')` | Error handler |
| `FCRList.jsx:72` | `alert('Failed to approve FCR')` | Error handler |
| `FCRList.jsx:88` | `alert('Failed to reject FCR')` | Error handler |
| `FCRList.jsx:106` | `alert('Failed to delete FCR')` | Error handler |
| `FCRFormBody.jsx:122` | `alert(\`"${p.name}" isn't at Bidding status...\`)` | Validation guard (pipeline import) |
| `FCRFormBody.jsx:138` | `alert(\`"${p.name}" is at "${p.status...}"...\`)` | Validation guard (pipeline import) |
| `ItineraryApproval.jsx:109` | `alert('Failed to approve itinerary')` | Error handler |
| `ItineraryApproval.jsx:133` | `alert('Failed to reject itinerary')` | Error handler |
| `ItineraryList.jsx:70` | `alert('Failed to approve itinerary')` | Error handler |
| `ItineraryList.jsx:86` | `alert('Failed to reject itinerary')` | Error handler |
| `ItineraryList.jsx:104` | `alert('Failed to delete MCP (Plan)')` | Error handler |
| `AccountList.jsx:64` | `alert('Failed to delete account')` | Error handler |

(Two of the 16 are the FCRFormBody validation messages listed above; the rest are error handlers in `catch` blocks.)

### `confirm()` — 5 call sites (become a shared `ConfirmDialog` built on base-ui's `AlertDialog`)

| File:Line | Current call |
| --- | --- |
| `FCRList.jsx:99` | `if (!confirm('Delete this FCR? This cannot be undone.')) return` |
| `ItineraryList.jsx:97` | `if (!confirm('Delete this MCP (Plan)? This cannot be undone.')) return` |
| `AccountList.jsx:57` | `if (!confirm('Delete this account? This cannot be undone.')) return` |
| `PipelineProjectsPanel.jsx:89` | `if (!confirm('Remove this linked Pipeline project?')) return` |
| `MCPArchive.jsx:68` | `if (!confirm('Delete this archived MCP (Actual)? This cannot be undone.')) return` |

### `prompt()` — 3 call sites (become a shared `PromptDialog` built on base-ui's `Dialog`)

| File:Line | Current call |
| --- | --- |
| `FCRApproval.jsx:122` | `const reason = prompt('Enter rejection reason:')` |
| `ItineraryApproval.jsx:116` | `const reason = prompt('Enter rejection reason:')` |
| `FCRList.jsx:77` | `const reason = prompt('Enter rejection reason:')` |
| `ItineraryList.jsx:75` | `const reason = prompt('Enter rejection reason:')` |

(That's actually 4 — `FCRList.jsx` and `ItineraryList.jsx` each duplicate the approval-page reject flow for the list view.)

## Target approach

1. **Add dependencies:** `@base-ui-components/react` (beta, confirmed on npm, current published version `1.0.0-beta.0` at time of writing — check for a newer stable release before installing) and `sonner`.
2. **Toaster:** mount `<Toaster />` once at the root (`src/App.jsx`), replace every `alert()` with `toast.error(message)` (error handlers) or `toast.error(message, { duration: ... })` for validation guards. None of the 16 `alert()` sites are success messages — they're all errors/validation, so no `toast.success()` needed for this pass unless the executor wants to add one for the delete/approve/reject success paths too (optional nice-to-have, not required to close this plan).
3. **`ConfirmDialog`:** one new shared component (`src/components/ConfirmDialog.jsx`) wrapping base-ui's `AlertDialog.Root`/`Trigger`/`Portal`/`Backdrop`/`Popup`/`Title`/`Description`/`Close`, styled to match this app's existing modal look (reuse the same `bg-gray-900/40` backdrop + `bg-white rounded-xl shadow-xl` dialog classes already established in `AboutModal.jsx`/`ItineraryForm.jsx`'s `VisitEntryModal` from Plan 001 — including the same `mounted`-state fade+scale-in pattern at `duration-200 ease-out-strong`, so this new dialog is visually consistent with the rest of the app). Takes `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `onConfirm` props. Each of the 5 `confirm()` call sites converts from a synchronous `if (!confirm(...)) return` guard to: local `showConfirm` state → render `<ConfirmDialog>` → `onConfirm` runs the body that used to follow the `if` guard.
4. **`PromptDialog`:** one new shared component (`src/components/PromptDialog.jsx`), same visual treatment as `ConfirmDialog` but with a text `<input>` (styled with the existing `.input` class from `index.css`) instead of a plain description, `onSubmit(value)` callback. Each of the 4 `prompt()` call sites converts similarly — local `showRejectPrompt` state → render `<PromptDialog>` → `onSubmit` runs the body that used to follow `const reason = prompt(...); if (!reason) return`.
5. Both new dialogs get `active:scale-[0.97]` + `duration-160 ease-out-strong` on their action buttons (Plan 004's button pattern) for consistency.

## Steps

1. `npm install @base-ui-components/react sonner` — verify install succeeds and check the installed base-ui version against base-ui.com's current docs for the `AlertDialog` and `Dialog` API (beta packages can have breaking changes between versions; confirm the exact sub-component names — `AlertDialog.Root`, `.Trigger`, `.Portal`, `.Backdrop`, `.Popup`, `.Title`, `.Description`, `.Close` — match what's actually published before writing component code).
2. Add `import { Toaster } from 'sonner'` and `<Toaster position="top-right" richColors />` to `src/App.jsx`, near the app root (check existing `App.jsx` structure for where providers/layout wrap the routes — mount it once, outside the route switch, so it persists across navigation).
3. Build `src/components/ConfirmDialog.jsx` per the target approach above.
4. Build `src/components/PromptDialog.jsx` per the target approach above.
5. Replace all 16 `alert()` call sites with `toast.error(...)` (import `{ toast }` from `'sonner'` in each file). Keep the exact same message strings — this pass is about the delivery mechanism, not the copy.
6. Replace all 5 `confirm()` call sites with the `ConfirmDialog` pattern described above. Each conversion needs: a new piece of state to track which item is pending confirmation (e.g. `const [confirmDeleteId, setConfirmDeleteId] = useState(null)`), the delete button now sets that state instead of calling `confirm()` inline, and the actual delete logic moves into the dialog's `onConfirm`.
7. Replace all 4 `prompt()` call sites the same way, using `PromptDialog`.
8. Do not touch any Supabase query logic, RLS-dependent behavior, or the actual approve/reject/delete business logic — only the presentation layer around triggering and confirming those actions changes.

## Scope boundaries

- New files: `src/components/ConfirmDialog.jsx`, `src/components/PromptDialog.jsx`.
- Modified files: `src/App.jsx` (Toaster mount), `package.json`/`package-lock.json` (new deps), and the 9 files listed in the tables above.
- Do not build a generic "Modal" wrapper to also refactor `AboutModal.jsx`/`VisitEntryModal` in this pass — that was noted as a separate missed opportunity in the original audit; keep this plan scoped to replacing native browser dialogs only.
- Do not add toast notifications for actions that don't currently have any user feedback (e.g. don't invent new `toast.success()` calls beyond what's listed) unless doing so is trivial and the executor calls it out explicitly as an addition.

## Verification

1. `npm run build` — confirm no type/import errors from the new dependencies.
2. `npm run dev`, exercise each converted flow:
   - Trigger a validation `alert()` case (e.g. try approving an FCR whose account hasn't acknowledged minutes) — confirm a Sonner toast appears instead of a native alert, and it's dismissible/auto-dismisses.
   - Trigger a `confirm()` case (e.g. delete an account) — confirm the new dialog fades/scales in matching the existing modal style, Cancel closes it with no action taken, Confirm runs the delete and shows a toast on success/failure.
   - Trigger a `prompt()` case (reject an FCR or itinerary) — confirm the dialog collects a reason via a real input, empty submission is blocked (matching the old `if (!reason) return` behavior), and the reason reaches the Supabase update call unchanged.
3. Confirm no `alert(`, `confirm(`, or `prompt(` calls remain in `src/` (grep to verify): `grep -rn "alert(\|[^.]confirm(\|prompt(" src/`.
4. Feel-check the new dialogs against `review-animations`' bar — they should match Plan 001's modal entrance (`scale(0.95)→1`, `opacity 0→1`, 200ms `ease-out-strong`, centered `transform-origin`).
5. Confirm toasts respect `prefers-reduced-motion` (Sonner has built-in support for this; verify by emulating reduced motion in DevTools Rendering tab and checking the toast still appears without a slide/spring animation, matching Plan 006's intent).
