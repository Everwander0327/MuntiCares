import { AlertTriangle, Home, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/shared/ui';

const describeCause = (failure) => {
  switch (failure?.reason) {
    case 'too_far':
      return `${Math.round(failure.distance_m || 0)} m from the visit location`;
    case 'low_accuracy':
      return `GPS is only accurate to \u00b1${Math.round(failure.accuracy_m || 0)} m`;
    case 'stale_location':
      return 'the GPS signal is delayed';
    case 'no_location':
      return 'no GPS location has been recorded';
    default:
      return 'the arrival location could not be verified';
  }
};

/**
 * Shown when the server rejects a GPS-verified arrival (distance, accuracy,
 * freshness or missing fix). Confirming sends the audited manual override.
 */
export default function ArrivalOverrideDialog({ open, failure, busy = false, onCancel, onConfirm }) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 sm:mx-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>Confirm you are at the patient&apos;s home</DialogTitle>
          <DialogDescription>
            Automatic arrival is locked because {describeCause(failure)}. Confirming records your
            manual override and reported position for audit.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Home className="h-4 w-4" />}
            {busy ? 'Marking arrived\u2026' : 'Yes, I am on site'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
