import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PatientRecordModal from '../features/provider/components/PatientRecordModal';
import FhirExportModal from '../shared/components/FhirExportModal';
import Navbar from '../shared/navigation/Navbar';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../shared/ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../shared/ui/sheet';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';

vi.mock('../lib/supabase', () => {
  const chainHandler = {
    get(_, prop) {
      // Both `.then(cb)` and `await` must work: PatientRecordModal uses the first,
      // fetchConsentGrant the second. Resolving to a plain object keeps `await` from
      // re-adopting the thenable proxy in a cycle.
      if (prop === 'then') {
        return (onFulfilled, onRejected) =>
          Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
      }
      return vi.fn().mockImplementation(() => new Proxy({}, chainHandler));
    },
  };
  const chain = new Proxy({}, chainHandler);

  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn((callback) => {
          callback?.('INITIAL_SESSION', null);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        updateUser: vi.fn(),
      },
      channel: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn() })), subscribe: vi.fn(), unsubscribe: vi.fn() })),
      removeChannel: vi.fn(),
      removeAllChannels: vi.fn(),
    },
  };
});

const locked = () => document.body.classList.contains('modal-open');

beforeEach(() => {
  document.body.className = '';
  document.body.style.overflow = '';
});

afterEach(cleanup);

// PatientProfileView.jsx mounts both of these on the same route, so they really do stack.
function StackedModals() {
  const [chartOpen, setChartOpen] = useState(true);
  const [fhirOpen, setFhirOpen] = useState(true);
  return (
    <>
      <PatientRecordModal
        isOpen={chartOpen}
        onClose={() => setChartOpen(false)}
        patientId="patient-1"
        patientName="Rizalina Bautista"
      />
      <FhirExportModal
        open={fhirOpen}
        onClose={() => setFhirOpen(false)}
        bundle={{ entry: [] }}
        patientName="Rizalina Bautista"
      />
      <button type="button" data-testid="close-fhir" onClick={() => setFhirOpen(false)}>close fhir</button>
      <button type="button" data-testid="close-chart" onClick={() => setChartOpen(false)}>close chart</button>
    </>
  );
}

function renderInApp(ui) {
  return render(
    <AuthProvider>
      <ThemeProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </AuthProvider>,
  );
}

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

// C7: eight overlays add/remove `modal-open` themselves instead of going through the
// refcounted hook, so whichever one closes last wins — closing the top of a stack
// unlocks the page underneath the overlay that is still open.
describe('C7 — stacked overlays share one refcounted scroll lock', () => {
  it('locks the body while either of two stacked modals is open', async () => {
    renderInApp(<StackedModals />);
    await settle();

    expect(locked()).toBe(true);

    fireEvent.click(screen.getByTestId('close-fhir'));
    await settle();
    expect(locked()).toBe(true);

    fireEvent.click(screen.getByTestId('close-chart'));
    await settle();
    expect(locked()).toBe(false);
  });

  it('releases the lock when the last overlay unmounts', async () => {
    const { unmount } = renderInApp(<StackedModals />);
    await settle();
    expect(locked()).toBe(true);

    unmount();
    expect(locked()).toBe(false);
  });
});

// The Navbar is the third mechanism: it writes document.body.style.overflow directly,
// which the shared lock cannot count.
describe('C7 — the navbar menu uses the same lock as overlays', () => {
  it('locks through body.modal-open rather than an inline style', async () => {
    renderInApp(<Navbar />);
    await settle();
    expect(locked()).toBe(false);

    fireEvent.click(screen.getByLabelText('Open menu'));
    await settle();
    expect(locked()).toBe(true);
    expect(document.body.style.overflow).toBe('');

    fireEvent.click(screen.getByLabelText('Close menu'));
    await settle();
    expect(locked()).toBe(false);
  });
});

describe('Modal & Sheet outside-click light dismiss', () => {
  it('closes PatientRecordModal when clicking outside the modal card but not inside', async () => {
    const onClose = vi.fn();
    renderInApp(
      <PatientRecordModal
        isOpen
        onClose={onClose}
        patientId="patient-1"
        patientName="Rizalina Bautista"
      />,
    );
    await settle();

    const dialogWrapper = screen.getByRole('dialog');
    const innerCard = dialogWrapper.firstElementChild;

    fireEvent.click(innerCard);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialogWrapper);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes shared Dialog and Sheet primitives when clicking their backdrop overlays', () => {
    const onDialogOpenChange = vi.fn();
    const { unmount } = render(
      <Dialog open onOpenChange={onDialogOpenChange}>
        <DialogContent>
          <DialogTitle>Test Dialog</DialogTitle>
          <DialogDescription>Dialog body</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole('button', { name: /^Close$/i })).not.toBeInTheDocument();
    const dialogOverlay = document.querySelector('[data-state="open"].fixed.inset-0');
    fireEvent.click(dialogOverlay);
    expect(onDialogOpenChange).toHaveBeenCalledWith(false);
    unmount();

    const onSheetOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onSheetOpenChange}>
        <SheetContent>
          <SheetTitle>Test Sheet</SheetTitle>
          <SheetDescription>Sheet body</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    const sheetOverlay = document.querySelector('[data-state="open"].fixed.inset-0');
    fireEvent.click(sheetOverlay);
    expect(onSheetOpenChange).toHaveBeenCalledWith(false);
  });
});
