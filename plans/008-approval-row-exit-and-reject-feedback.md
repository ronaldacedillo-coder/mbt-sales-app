# Plan 008 — Approval row fade-out + Reject processing feedback

**Status:** TODO
**Commit stamped:** 028567b (re-verify line numbers before executing — Plans 001-007 may have shifted nearby code)
**Severity:** MEDIUM (state indication) / LOW (feedback parity)
**Category:** Missed opportunity, surfaced by a `find-animation-opportunities` pass on the approval pages

## Problem

Two confirmed gaps in `src/pages/FCR/FCRApproval.jsx` and `src/pages/itinerary/ItineraryApproval.jsx` (structurally identical components — same `handleApprove`/`handleReject`/`fetchX` pattern, same card markup):

### A — Card vanishes with no exit transition

Both `handleApprove` and `handleReject` call `fetchFCRs()` / `fetchItineraries()` on success, which replaces the entire list. If the acted-on item no longer matches `statusFilter` (the default view is `'pending_approval'`), it disappears from the list the instant the new data arrives — no fade, no bridge. This is a "preventing a jarring change" gap: a meaningful decision (approve/reject) deserves a visible confirmation beat before the item leaves the screen.

`FCRApproval.jsx:90-119` (handlers) and `:210-311` (the `.map` rendering each card):
```jsx
const handleApprove = async (id, ackStatus) => {
  // ...
  setProcessing(id)
  try {
    const { error } = await supabase.from('fcrs').update({ status: 'approved', /* ... */ }).eq('id', id)
    if (error) throw error
    fetchFCRs()
  } catch (error) {
    // ...
  } finally {
    setProcessing(null)
  }
}
```
```jsx
{fcrs.map((item) => (
  <div key={item.id} className="card">
```

`ItineraryApproval.jsx:94-113` (handleApprove), `:115-135` (handleReject), `:204` (the `.map`) — same shape.

### B — Reject button has no processing state

`FCRApproval.jsx:293-301` (Approve button) shows `{processing === item.id ? 'Processing...' : 'Approve'}`, but the Reject button right next to it (`:285-292`) shows a static `Reject` label the entire time, even while `processing === item.id` is true and the button is disabled:

```jsx
<button
  onClick={() => handleReject(item.id)}
  disabled={processing === item.id}
  className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50"
>
  <XCircle size={16} />
  Reject
</button>
```

Identical gap in `ItineraryApproval.jsx:301-308`.

## Target approach

### A — fade + scale out before the list refreshes

Add a `removingId` state per component. On successful approve/reject, before calling `fetchFCRs()`/`fetchItineraries()`, set `removingId` to the item's id, wait for a short transition (~200ms) via a `Promise`-wrapped `setTimeout`, then fetch and clear `removingId`. The card's `className` gets a conditional fade+scale when its id matches `removingId`:

```jsx
className={`card transition-all duration-200 ease-out-strong ${
  removingId === item.id ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
}`}
```

This intentionally does **not** attempt a full height-collapse animation (animating `max-height` to 0 reliably requires a known pixel height, which adds real complexity for a component with variable expanded/collapsed content) — the fade+scale is the correct scoped fix per the "prefer the simpler remedial move" principle. When the list re-fetches after the delay, the other cards reflow to fill the gap instantly, which is standard and acceptable (most production apps don't animate sibling reflow).

Use `ease-out-strong` (Plan 003's token) and `duration-200`, consistent with the rest of this app's motion.

### B — Reject processing text

Mirror the exact pattern Approve already uses, one line change per file:

```jsx
{processing === item.id ? 'Rejecting...' : 'Reject'}
```

## Steps

### `src/pages/FCR/FCRApproval.jsx`

1. Add `const [removingId, setRemovingId] = useState(null)` alongside the existing `processing` state (near line 32).
2. In `handleApprove` (line 90), after the successful `update` and before `fetchFCRs()`:
   ```jsx
   if (error) throw error
   setRemovingId(id)
   await new Promise((resolve) => setTimeout(resolve, 200))
   fetchFCRs()
   ```
   (Keep the existing `finally { setProcessing(null) }` — also add `setRemovingId(null)` there so it resets even on error.)
3. Apply the identical change to `handleReject` (line 121).
4. On the card wrapper (line 211), change:
   ```jsx
   <div key={item.id} className="card">
   ```
   to:
   ```jsx
   <div
     key={item.id}
     className={`card transition-all duration-200 ease-out-strong ${
       removingId === item.id ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
     }`}
   >
   ```
5. On the Reject button (line 285-292), change the static `Reject` text (currently just `Reject` on its own line after the icon) to `{processing === item.id ? 'Rejecting...' : 'Reject'}`, matching the Approve button's pattern at line 300.

### `src/pages/itinerary/ItineraryApproval.jsx`

6. Apply the same five changes: add `removingId` state, update `handleApprove` (line 94) and `handleReject` (line 115) with the `setRemovingId` + delay + fetch sequence (and reset in `finally`), add the conditional fade+scale class to the card wrapper (line 205), and add the `Rejecting...` text swap to the Reject button (line 301-308).

## Scope boundaries

- Only these two files change.
- No change to the underlying Supabase queries, RLS behavior, or the actual approve/reject decision logic — purely presentation/timing around the existing success path.
- Do not attempt to animate list reflow (siblings shifting up) — out of scope per the target approach above.
- If Plan 007 (toast/dialog swap) has already landed, the `alert('Failed to approve FCR')` / `alert('Failed to reject FCR')` calls in the `catch` blocks here will already be `toast.error(...)` — don't revert them; this plan only touches the success path and the button label.

## Verification

1. `npm run dev`, go to FCR Approvals (or MCP Plan Approvals), with the filter on "Pending".
2. Approve or reject an item — confirm the card now visibly fades and shrinks slightly (~200ms) before disappearing, instead of snapping out.
3. Click Reject and confirm the button shows "Rejecting..." while the request is in flight (same visual treatment as Approve's "Processing...").
4. Trigger a failure case if possible (e.g. simulate a network error) and confirm `removingId` resets correctly — the card should NOT fade out if the update actually failed, since `setRemovingId(id)` only runs after `if (error) throw error` passes.
5. Feel-check in slow motion (Chrome DevTools Animations panel, 4x slowdown) that the fade+scale reads as one coordinated motion, not a flash.
6. Confirm `prefers-reduced-motion: reduce` (from Plan 006) still applies correctly — the transition should resolve near-instantly when that preference is emulated.
