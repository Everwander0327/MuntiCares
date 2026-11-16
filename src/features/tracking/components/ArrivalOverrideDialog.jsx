import { Warning, House, SpinnerGap } from '@phosphor-icons/react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/shared/ui';

const describeCause = (failure, t) => {
  switch (failure?.reason) {
    case 'too_far':
      return t('tracking.override.tooFar', { distance: Math.round(failure.distance_m || 0) });
    case 'low_accuracy':
      return t('tracking.override.lowAccuracy', { accuracy: Math.round(failure.accuracy_m || 0) });
    case 'stale_location':
      return t('tracking.override.stale');
    case 'no_location':
      return t('tracking.override.noLocation');
    default:
      return t('tracking.override.fallback');
  }
};

/**
 * Shown when the server rejects a GPS-verified arrival (distance, accuracy,
 * freshness or missing fix). Confirming sends the audited manual override.
 */
export default function ArrivalOverrideDialog({ open, failure, busy = false, onCancel, onConfirm }) {
  const { t } = useLanguage();
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
            <Warning className="h-5 w-5" />
          </div>
          <DialogTitle>{t('tracking.override.title')}</DialogTitle>
          <DialogDescription>
            {t('tracking.override.desc', { cause: describeCause(failure, t) })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t('common.actions.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? <SpinnerGap className="h-4 w-4 animate-spin" /> : <House className="h-4 w-4" />}
            {busy ? t('tracking.override.marking') : t('tracking.override.confirmBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
