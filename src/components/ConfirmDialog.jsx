import { useEffect, useState } from 'react'
import { AlertDialog } from '@base-ui-components/react/alert-dialog'
import { AlertTriangle } from 'lucide-react'

// Shared confirmation dialog -- replaces native `confirm()` calls throughout
// the app. Visual treatment (backdrop fade + dialog scale-in, 200ms
// ease-out-strong) matches AboutModal/VisitEntryModal from the animation
// audit, so every dialog in the app now looks and feels the same.
//
// Usage:
//   const [confirmOpen, setConfirmOpen] = useState(false)
//   <ConfirmDialog
//     open={confirmOpen}
//     onOpenChange={setConfirmOpen}
//     title="Delete this account?"
//     description="This cannot be undone."
//     confirmLabel="Delete"
//     onConfirm={() => { /* the code that used to run after `if (confirm(...))` */ }}
//   />
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  danger = true,
}) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(open)
  }, [open])

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={`fixed inset-0 bg-gray-900/40 z-50 transition-opacity duration-200 ease-out-strong ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <AlertDialog.Popup
            className={`bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden transition-all duration-200 ease-out-strong ${
              mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="px-5 py-4">
              <AlertDialog.Title className="font-semibold text-gray-900 flex items-center gap-2">
                {danger && <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />}
                {title}
              </AlertDialog.Title>
              {description && (
                <AlertDialog.Description className="text-sm text-gray-600 mt-2">
                  {description}
                </AlertDialog.Description>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
              <AlertDialog.Close className="btn-secondary">
                Cancel
              </AlertDialog.Close>
              <button
                type="button"
                onClick={() => {
                  onConfirm()
                  onOpenChange(false)
                }}
                className={danger ? 'btn-danger' : 'btn-primary'}
              >
                {confirmLabel}
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
