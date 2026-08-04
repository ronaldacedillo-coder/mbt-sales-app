import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'

// Shared single-input prompt dialog -- replaces native `prompt()` calls
// throughout the app (used for collecting a rejection reason). Same visual
// treatment as ConfirmDialog/AboutModal (200ms fade + scale-in,
// ease-out-strong), plus an input styled with the app's existing `.input`
// class.
//
// Usage:
//   const [rejectOpen, setRejectOpen] = useState(false)
//   <PromptDialog
//     open={rejectOpen}
//     onOpenChange={setRejectOpen}
//     title="Enter rejection reason"
//     label="Rejection reason"
//     confirmLabel="Reject"
//     onSubmit={(reason) => { /* the code that used to run after `const reason = prompt(...); if (!reason) return` */ }}
//   />
export const PromptDialog = ({
  open,
  onOpenChange,
  title,
  label = 'Reason',
  placeholder = '',
  confirmLabel = 'Submit',
  onSubmit,
}) => {
  const [mounted, setMounted] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    setMounted(open)
    if (open) setValue('')
  }, [open])

  const canSubmit = value.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(value.trim())
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={`fixed inset-0 bg-gray-900/40 z-50 transition-opacity duration-200 ease-out-strong ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup
            className={`bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden transition-all duration-200 ease-out-strong ${
              mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="px-5 py-4">
              <Dialog.Title className="font-semibold text-gray-900">{title}</Dialog.Title>
              <label className="label mt-3">{label}</label>
              <textarea
                autoFocus
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="input resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
                }}
              />
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
              <Dialog.Close className="btn-secondary">Cancel</Dialog.Close>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmLabel}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
