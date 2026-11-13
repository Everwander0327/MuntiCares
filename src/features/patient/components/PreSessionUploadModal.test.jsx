import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import PreSessionUploadModal from './PreSessionUploadModal';

// Node 24+ exposes a localStorage global that errors/returns undefined without
// --localstorage-file, shadowing jsdom's Storage. Stub both globals cleanly.
const memoryStore = new Map();
const localStorageStub = {
  getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
  setItem: (key, value) => memoryStore.set(key, String(value)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};
for (const target of [globalThis, window]) {
  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    value: localStorageStub,
  });
}

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  fn.error = vi.fn();
  fn.success = vi.fn();
  return fn;
});

const supabaseMock = vi.hoisted(() => {
  const uploadMock = vi.fn().mockResolvedValue({ error: null });
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const singleMock = vi.fn().mockResolvedValue({ data: { notes: 'Initial booking note' }, error: null });
  const updateEqMock = vi.fn().mockResolvedValue({ error: null });

  const fromMock = vi.fn((table) => {
    if (table === 'patient_documents') {
      return { insert: insertMock };
    }
    if (table === 'requests') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: singleMock })),
        })),
        update: vi.fn((payload) => {
          fromMock.lastUpdatePayload = payload;
          return { eq: updateEqMock };
        }),
      };
    }
    return {};
  });

  return {
    uploadMock,
    insertMock,
    singleMock,
    updateEqMock,
    fromMock,
    client: {
      storage: {
        from: vi.fn(() => ({ upload: uploadMock })),
      },
      from: fromMock,
    },
  };
});

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  toast: toastMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-patient-1' } }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock.client,
}));

const BASE_REQUEST = {
  id: 'req-123',
  patientId: 'patient-99',
  providerName: 'Mang Kepweng',
  service: 'Wound Care',
};

describe('PreSessionUploadModal — Direction 1 Guided 2-Tab Bottom Sheet', () => {
  beforeEach(() => {
    memoryStore.clear();
    document.body.className = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('starts on Prep Checklist tab, persists toggles & Mark all ready, and locks body scroll', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <PreSessionUploadModal isOpen request={BASE_REQUEST} onClose={onClose} />,
    );

    expect(document.body.classList.contains('modal-open')).toBe(true);
    expect(screen.getByRole('heading', { name: /Pre-Session Information/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /1\. Prep \(0\/6\)/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('0 of 6 tasks ready')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Prepare your medical ID/i }));
    expect(screen.getByText('1 of 6 tasks ready')).toBeInTheDocument();
    expect(JSON.parse(memoryStore.get('presession_checklist_req-123'))).toEqual({ id: true });

    fireEvent.click(screen.getByRole('button', { name: /Mark all ready/i }));
    expect(screen.getByText('6 of 6 tasks ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear all/i })).toBeInTheDocument();

    rerender(<PreSessionUploadModal isOpen={false} request={BASE_REQUEST} onClose={onClose} />);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('opens directly on Vitals & Docs tab when all 6 checklist items are already done', () => {
    memoryStore.set('presession_checklist_req-123', JSON.stringify({
      id: true,
      medications: true,
      insurance: true,
      questions: true,
      space: true,
      companion: true,
    }));

    render(<PreSessionUploadModal isOpen request={BASE_REQUEST} onClose={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /2\. Vitals & Docs/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Blood Pressure')).toHaveAttribute('inputmode', 'text');
    expect(screen.getByLabelText('Temperature')).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByLabelText('Heart Rate')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText('Weight')).toHaveAttribute('inputmode', 'decimal');
  });

  it('guards empty intake submit and submits vitals + quick symptom pills without duplicate units', async () => {
    const onClose = vi.fn();
    render(<PreSessionUploadModal isOpen request={BASE_REQUEST} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Vitals, Symptoms & Files/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Send to Mang Kepweng/i })).toBeInTheDocument();
    });

    // Empty submit shows inline alert & toast without calling Supabase
    fireEvent.click(screen.getByRole('button', { name: /Send to Mang Kepweng/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Add at least one vital, symptom note, or file/i);
    expect(toastMock.error).toHaveBeenCalledTimes(1);
    expect(supabaseMock.fromMock).not.toHaveBeenCalled();

    // Enter numeric vitals + tap symptom pill
    fireEvent.change(screen.getByLabelText('Temperature'), { target: { value: '37.4' } });
    fireEvent.change(screen.getByLabelText('Heart Rate'), { target: { value: '78' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Fever/i }));

    fireEvent.click(screen.getByRole('button', { name: /Send to Mang Kepweng/i }));

    await waitFor(() => {
      expect(supabaseMock.updateEqMock).toHaveBeenCalledWith('id', 'req-123');
      expect(toastMock.success).toHaveBeenCalledWith('Pre-session info submitted successfully!');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    expect(supabaseMock.fromMock.lastUpdatePayload).toEqual({
      notes: 'Initial booking note\n[Pre-session Symptoms] Fever | Temp: 37.4°C | HR: 78 bpm',
    });
    expect(JSON.parse(memoryStore.get('mc_presession_submitted_user-patient-1'))).toEqual({ 'req-123': true });
  });
});
