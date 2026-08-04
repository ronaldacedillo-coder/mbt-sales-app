# Plan 009 — Inline field-level validation errors

**Status:** DONE
**Commit stamped:** 82f995b (re-verify line numbers before executing)
**Severity:** MEDIUM
**Category:** UX guideline gap, surfaced by the `ui-ux-pro-max` skill's UX guideline database ("Error Placement": *"Errors should appear near the problem. Do: show error below related input. Don't: single error message at top of form."*)

## Problem

Both `src/pages/Accounts/AccountForm.jsx` and `src/pages/FCR/FCRForm.jsx` use a single `error` string rendered once as a banner at the top of the form (`AccountForm.jsx:292-297`, `FCRForm.jsx:314-319`) for every failure — both real field-validation problems ("Please select Trade Terms below") and generic async failures ("Failed to save account"). On these forms (AccountForm has 8 card sections; FCRForm's body is even longer via `FCRFormBody`), a user who trips a validation check has to scroll back up to read what's wrong, then scroll back down to find the field.

Since Plan 007 already added Sonner to this app, the cleanest fix is to split these two error types:
- **Field-validation errors** (the user needs to fix a specific input) → inline, next to that field.
- **Generic async failures** (load/save/network errors with no single field to blame) → `toast.error()`, consistent with every other error path in the app after Plan 007.

## Confirmed call sites

### `AccountForm.jsx`

| Line | Current call | Type | Target field |
| --- | --- | --- | --- |
| 178 | `setError('Failed to load account')` | Generic | → `toast.error(...)` |
| 205 | `setError('Please select a Customer Type first')` | Field | `customer_type` (select at line 335-353) |
| 229 | `setError('Please select Trade Terms below -- an account can't be saved without it...')` | Field | Trade Terms section (lines 408-427) |
| 233 | `setError('Please specify which MBT Distributor this account transacts through.')` | Field | `distributor_name` (lines 429-453) |
| 259 | `setError(err.message \|\| 'Failed to save account')` | Generic | → `toast.error(...)` |

### `FCRForm.jsx`

| Line | Current call | Type | Target field |
| --- | --- | --- | --- |
| 87 | `setError('Failed to load FCR')` | Generic | → `toast.error(...)` |
| 95, 134 | `setError('Please select an account above...')` | Field | `account_id` — lives inside the `FCRFormBody` child component (its select is at `FCRFormBody.jsx:187-196`) |
| 126 | `setError(err.message \|\| 'Failed to save FCR')` | Generic | → `toast.error(...)` |
| 138 | `setError('Please fill in the meeting attendee's name and email...')` | Field (split) | `attendee_name` / `attendee_email` — also inside `FCRFormBody` (`FCRFormBody.jsx:556-561` and `568-574`) |
| 142 | `setError('This FCR can't be submitted for approval yet...')` | Workflow state, not one field | → `toast.error(...)` (no single input to anchor to) |
| 155 | `setError('Enter the attendee's email address first')` | Field | `attendee_email` |
| 219 | `setError(err.message \|\| 'Failed to send the acknowledgment request')` | Generic | → `toast.error(...)` |
| 242 | `setError(err.message \|\| 'Failed to refresh acknowledgment status')` | Generic | → `toast.error(...)` |
| 256 | `setError('Failed to generate the PDF file')` | Generic | → `toast.error(...)` |

**Important constraint:** `account_id`, `attendee_name`, and `attendee_email` are rendered inside `FCRFormBody.jsx`, a separate component used by both `FCRForm.jsx` (editable) and `FCRApproval.jsx` (read-only review, which calls it with `onChange={() => {}}` and no error-related props today). Passing field errors down requires a new optional prop on `FCRFormBody`, defaulted so `FCRApproval.jsx`'s existing call site keeps working unmodified.

## Target approach

### AccountForm.jsx

1. Replace `const [error, setError] = useState('')` with `const [fieldErrors, setFieldErrors] = useState({})` (an object keyed by field name, e.g. `{ trade_terms: '...' }`).
2. Import `{ toast }` from `'sonner'`.
3. Remove the top banner block entirely (lines 292-297).
4. At the top of `handleSubmit`, replace `setError('')` with `setFieldErrors({})`.
5. Each validation branch sets one key instead of the shared string:
   ```jsx
   if (!formData.trade_terms) {
     setFieldErrors({ trade_terms: 'Select Trade Terms below -- an account can\'t be saved without it, since Itinerary and FCR only let reps pick from fully profiled accounts.' })
     return
   }
   if (formData.trade_terms === TRADE_TERMS.DISTRIBUTOR && !formData.distributor_name?.trim()) {
     setFieldErrors({ distributor_name: 'Specify which MBT Distributor this account transacts through.' })
     return
   }
   ```
   Same pattern for `generateRecommendation`'s `customer_type` check.
6. Generic failures become `toast.error(...)`:
   ```jsx
   } catch (err) {
     setError('Failed to load account')   // becomes:
   } catch (err) {
     toast.error('Failed to load account')
   ```
   (and the same for the save-failure catch at line 259).
7. Add inline error rendering under each of the three fields, matching this app's existing red-error visual language (the `AlertCircle` + red text already used in the banner, just scoped smaller):
   ```jsx
   {fieldErrors.customer_type && (
     <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
       <AlertCircle size={12} />{fieldErrors.customer_type}
     </p>
   )}
   ```
   Place this immediately after the `customer_type` `<select>` (after line 352's closing `</select>`), after the Trade Terms button grid (after line 427's closing `</div>`, before the conditional distributor block), and after the `distributor_name` input/select (after line 451/452's closing element, inside the `mt-4` wrapper div from line 430).

### FCRForm.jsx + FCRFormBody.jsx

8. In `FCRForm.jsx`: same `error` → `fieldErrors` state split as above. Import `toast` from `'sonner'`. Remove the top banner (lines 314-319). Route every "Generic" row from the table above through `toast.error(...)`. Route the three "Field" rows (95/134 combined, 138 split into two keys, 155) into `setFieldErrors({...})`:
   ```jsx
   // handleSave / handleSubmitForApproval
   if (!record.account_id) {
     setFieldErrors({ account_id: 'Select an account above -- an FCR can only be filed against a profiled account' })
     return
   }
   // handleSubmitForApproval only
   if (!record.attendee_name || !record.attendee_email) {
     setFieldErrors({
       ...(!record.attendee_name ? { attendee_name: 'Required before submitting for approval' } : {}),
       ...(!record.attendee_email ? { attendee_email: 'Required before submitting for approval' } : {}),
     })
     return
   }
   if (record.ack_status !== 'acknowledged') {
     toast.error('This FCR can\'t be submitted for approval yet -- only FCRs acknowledged by the account are sent to the NSM or Commercial AC Head. Send the acknowledgment request below first.')
     return
   }
   ```
   ```jsx
   // handleSendAcknowledgment
   if (!record.attendee_email) {
     setFieldErrors({ attendee_email: 'Enter the attendee\'s email address first' })
     return
   }
   ```
9. Pass `fieldErrors` down: `<FCRFormBody record={record} onChange={setRecord} teamType={teamType} readOnly={readOnly} accounts={accounts} submitterName={profile?.full_name} fieldErrors={fieldErrors} />`.
10. In `FCRFormBody.jsx`:
    - Add `fieldErrors = {}` to the destructured props at line 57: `export const FCRFormBody = ({ record, onChange, teamType, readOnly, accounts = [], submitterName = '', fieldErrors = {} }) => {`. The default keeps `FCRApproval.jsx`'s existing call (which doesn't pass this prop) working unchanged.
    - After the account `<select>` block (after line 196's `</select>`, before the existing `accounts.length === 0 ? ...` helper text), add:
      ```jsx
      {fieldErrors.account_id && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle size={12} />{fieldErrors.account_id}
        </p>
      )}
      ```
      (Check `FCRFormBody.jsx`'s imports for `AlertCircle` — add it to the lucide-react import if not already present.)
    - Extend the shared `Field` component (line 35-49) with an optional `error` prop:
      ```jsx
      const Field = ({ label, value, onChange, readOnly, type = 'text', error }) => (
        <div>
          <label className="label">{label}</label>
          {readOnly ? (
            <div className="input bg-gray-50 text-gray-700 min-h-[38px]">{value || <span className="text-gray-300">-</span>}</div>
          ) : (
            <input
              type={type}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={`input ${error ? 'border-red-300 focus:ring-red-500' : ''}`}
            />
          )}
          {error && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle size={12} />{error}
            </p>
          )}
        </div>
      )
      ```
    - Pass `error={fieldErrors.attendee_name}` and `error={fieldErrors.attendee_email}` to the two matching `<Field>` calls (lines 556-561 and 568-574). Leave `attendee_designation` (line 562-567) without an `error` prop — it has no validation rule.

## Scope boundaries

- Files touched: `src/pages/Accounts/AccountForm.jsx`, `src/pages/FCR/FCRForm.jsx`, `src/pages/FCR/FCRFormBody.jsx`.
- Do not touch `FCRApproval.jsx` — it already calls `FCRFormBody` without `fieldErrors`, and the new prop's default (`{}`) means nothing changes for it.
- Do not add client-side validation beyond what already exists (e.g. no new required-field rules) — this plan only relocates *existing* validation messages to be field-adjacent, it doesn't add new checks.
- Do not touch `AccountHistoryPanel`, `PipelineProjectsPanel`, or any other child component `FCRFormBody` renders.

## Verification

1. `npm run build` — confirm no errors (in particular, that `AlertCircle` is imported wherever newly referenced).
2. `npm run dev`, on **New Account**: click "Suggest" with no Customer Type selected — confirm the error now appears directly under the Customer Type dropdown, not at the top of the page. Try submitting with no Trade Terms selected, then with Distributor chosen but no distributor name — confirm each error appears next to its own section, and that selecting/fixing the field and resubmitting clears that specific error (via the `setFieldErrors({})` reset at the top of `handleSubmit`).
3. On **New FCR**: try "Save Draft" with no account selected — confirm the error appears under the Account dropdown. Select an account, fill in only the attendee name (leave email blank), try "Submit for Approval" — confirm the error appears only under the Attendee Email field, not the Name field.
4. Confirm generic failures still surface — e.g. temporarily break a Supabase call (or simulate offline) and confirm a toast appears instead of a page-top banner, matching the rest of the app's Plan 007 behavior.
5. Confirm `FCRApproval.jsx`'s read-only FCR preview (View Full FCR) still renders correctly with no console errors or warnings about missing props — it doesn't pass `fieldErrors`, so `FCRFormBody` must fall back to `{}` cleanly.
6. Feel-check against the `ui-ux-pro-max` UX guideline this plan is fixing: re-run `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form error placement" --domain ux -n 1` and confirm the implementation now matches the "Do" example (error below the related input).
