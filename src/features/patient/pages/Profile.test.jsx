import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PatientProfile from './Profile';

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

const navigateMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());
const mockAuthState = vi.hoisted(() => ({
  user: { id: 'patient-1', role: 'patient' },
  logout: logoutMock,
}));

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  fn.error = vi.fn();
  fn.success = vi.fn();
  fn.dismiss = vi.fn();
  return fn;
});

const supabaseMock = vi.hoisted(() => {
  const state = {
    userRow: {
      full_name: 'Juan Dela Cruz',
      email: 'juan@munticares.ph',
      created_at: '2026-01-15T00:00:00Z',
      avatar_url: '',
    },
    patientRow: {
      user_id: 'patient-1',
      phone: '09171234567',
      address: 'Block 4 Lot 2, Victoria Homes, Tunasan (Gate/Notes: Blue gate)',
      medical_notes: 'Ring bell twice',
      emergency_contact: 'Maria Cruz - 09187654321',
      is_profile_complete: true,
      latitude: 14.3789,
      longitude: 121.0456,
    },
    historyRows: [
      {
        id: 'mh-1',
        allergies: 'Shellfish',
        chronic_conditions: 'Hypertension',
        past_surgeries: '',
      },
    ],
    documents: [
      {
        id: 'doc-1',
        document_title: 'Lab_Result.pdf',
        file_path: 'patient-1/lab.pdf',
        uploaded_at: '2026-10-01T10:00:00Z',
      },
    ],
    visitNotes: [
      {
        id: 'note-1',
        created_at: '2026-10-15T10:00:00Z',
        provider: { full_name: 'Santos' },
        services_rendered: 'Wound Care',
        vitals_bp: '120/80',
        notes: 'Clean healing.',
      },
    ],
  };

  const upsertPatientsMock = vi.fn().mockResolvedValue({ error: null });
  const updateHistoryMock = vi.fn().mockResolvedValue({ error: null });
  const deleteDocEqMock = vi.fn().mockResolvedValue({ error: null });
  const storageRemoveMock = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table) => {
    if (table === 'users') {
      return {
        select: vi.fn((cols) => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: cols === 'avatar_url' ? { avatar_url: state.userRow.avatar_url } : state.userRow,
              error: null,
            }),
          })),
        })),
      };
    }

    if (table === 'patients') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: state.patientRow, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: state.patientRow, error: null }),
          })),
        })),
        upsert: upsertPatientsMock,
      };
    }

    if (table === 'medical_histories') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: state.historyRows, error: null }),
        })),
        update: vi.fn((payload) => {
          updateHistoryMock.lastPayload = payload;
          return { eq: updateHistoryMock };
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }

    if (table === 'patient_documents') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: state.documents, error: null }),
          })),
        })),
        delete: vi.fn(() => ({ eq: deleteDocEqMock })),
      };
    }

    if (table === 'visit_notes') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: state.visitNotes, error: null }),
          })),
        })),
      };
    }

    return {};
  });

  return {
    state,
    upsertPatientsMock,
    updateHistoryMock,
    deleteDocEqMock,
    storageRemoveMock,
    from,
    client: {
      from,
      storage: {
        from: vi.fn(() => ({
          remove: storageRemoveMock,
          upload: vi.fn().mockResolvedValue({ error: null }),
        })),
      },
    },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/layouts/DashboardLayout', () => ({
  default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock.client,
}));

vi.mock('@/lib/supabaseHelpers', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed-doc.pdf'),
}));

vi.mock('react-hot-toast', () => ({
  default: toastMock,
  toast: toastMock,
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const MOTION_KEYS = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'whileTap',
    'whileHover',
    'layout',
    'layoutId',
    'variants',
    'drag',
    'dragControls',
    'dragListener',
    'dragConstraints',
    'dragElastic',
    'onDragEnd',
  ]);
  const stripMotionProps = (props) =>
    Object.fromEntries(Object.entries(props).filter(([k]) => !MOTION_KEYS.has(k)));

  const createTag = (tag) => {
    const Comp = React.forwardRef((props, ref) =>
      React.createElement(tag, { ...stripMotionProps(props), ref }),
    );
    Comp.displayName = `MockMotion(${tag})`;
    return Comp;
  };

  return {
    motion: {
      div: createTag('div'),
      button: createTag('button'),
      span: createTag('span'),
    },
    AnimatePresence: ({ children }) => <>{children}</>,
    useReducedMotion: () => true,
    useDragControls: () => ({ start: vi.fn() }),
  };
});

vi.mock('@/shared/components', () => ({
  ProfilePhotoUpload: ({ fullName, compact }) => (
    <div data-testid={compact ? 'avatar-compact' : 'avatar-full'}>{fullName}</div>
  ),
  FhirExportModal: ({ open }) => (open ? <div data-testid="fhir-modal">FHIR Modal</div> : null),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => ({
    internal: { pageSize: { getWidth: () => 210 }, getNumberOfPages: () => 1 },
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn(),
    splitTextToSize: vi.fn((txt) => [txt]),
    textWithLink: vi.fn(),
    addPage: vi.fn(),
    addImage: vi.fn(),
    setPage: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock('@/features/patient/components/PermanentAddressSection', () => ({
  default: ({ initialAddress, onChange }) => (
    <div data-testid="mock-permanent-address-section">
      <span>Loaded address: {initialAddress}</span>
      <button
        type="button"
        onClick={() =>
          onChange?.({
            address: 'Unit 9, Ayala Alabang, Muntinlupa (Gate/Notes: Green gate)',
            coords: { lat: 14.4215, lng: 121.0281 },
            street: 'Ayala Alabang, Muntinlupa',
            unit: 'Unit 9',
            subdivision: 'Phase 1',
            instructions: 'Green gate',
          })
        }
      >
        Simulate Map &amp; Street Edit
      </button>
    </div>
  ),
}));

const renderProfile = () =>
  render(
    <MemoryRouter>
      <PatientProfile />
    </MemoryRouter>,
  );

const switchTab = (namePattern) => {
  const tab = screen.getByRole('tab', { name: namePattern });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
};

describe('PatientProfile — Direction 1 Mobile Account Hub & Scoped Address Sheet', () => {
  beforeEach(() => {
    memoryStore.clear();
    document.body.className = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders mobile hero strip + summary pin card without inline map, and hydrates split emergency contact', async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByLabelText('Phone Number')).toHaveValue('09171234567');
    });

    expect(screen.getByTestId('avatar-compact')).toBeInTheDocument();
    expect(screen.getByLabelText('Emergency Contact Name')).toHaveValue('Maria Cruz');
    expect(screen.getByLabelText('Emergency Contact Number')).toHaveValue('09187654321');
    expect(screen.getByText('Default Home Pin')).toBeInTheDocument();
    expect(screen.getByText('Gate note: Blue gate')).toBeInTheDocument();
    expect(screen.getByText('GPS Pin: 14.37890, 121.04560')).toBeInTheDocument();

    // Scoped map editor is NOT mounted inline until Edit Pin & Address is clicked
    expect(screen.queryByTestId('mock-permanent-address-section')).not.toBeInTheDocument();

    // Mobile Account & Exports bottom sheet opens cleanly with swipe-down dismiss and no Close X button
    fireEvent.click(screen.getByRole('button', { name: /Open account and exports menu/i }));
    expect(screen.getByText(/Account & Health Exports/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Close account menu/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Medical Summary \(PDF\)/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('scopes map edits in modal (Cancel discards, Apply commits draft) and persists split emergency contact on Save', async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Edit Pin & Address/i })).toBeInTheDocument();
    });

    // Open modal -> stage edit -> Cancel -> summary stays unchanged
    fireEvent.click(screen.getByRole('button', { name: /Edit Pin & Address/i }));
    expect(screen.getByTestId('mock-permanent-address-section')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Simulate Map & Street Edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));

    expect(screen.getByText('Gate note: Blue gate')).toBeInTheDocument();
    expect(screen.queryByText(/You have unsaved changes/i)).not.toBeInTheDocument();

    // Open modal again -> stage edit -> Apply Home Address -> dirty state + summary updates
    fireEvent.click(screen.getByRole('button', { name: /Edit Pin & Address/i }));
    fireEvent.click(screen.getByRole('button', { name: /Simulate Map & Street Edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /Apply Home Address/i }));

    expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
    expect(screen.getByText('Ayala Alabang, Muntinlupa')).toBeInTheDocument();
    expect(screen.getByText('Unit 9 • Phase 1')).toBeInTheDocument();
    expect(screen.getByText('Gate note: Green gate')).toBeInTheDocument();
    expect(screen.getByText('GPS Pin: 14.42150, 121.02810')).toBeInTheDocument();

    // Update emergency contact fields & submit
    fireEvent.change(screen.getByLabelText('Emergency Contact Name'), {
      target: { value: 'Ana Reyes' },
    });
    fireEvent.change(screen.getByLabelText('Emergency Contact Number'), {
      target: { value: '09191112222' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    await waitFor(() => {
      expect(supabaseMock.upsertPatientsMock).toHaveBeenCalledTimes(1);
    });

    const [savedPayload] = supabaseMock.upsertPatientsMock.mock.calls[0];
    expect(savedPayload).toMatchObject({
      user_id: 'patient-1',
      address: 'Unit 9, Ayala Alabang, Muntinlupa (Gate/Notes: Green gate)',
      emergency_contact: 'Ana Reyes - 09191112222',
      emergency_contact_name: 'Ana Reyes',
      emergency_contact_phone: '09191112222',
      latitude: 14.4215,
      longitude: 121.0281,
      is_profile_complete: true,
    });

    await waitFor(() => {
      expect(screen.getByText('All profile changes saved')).toBeInTheDocument();
    });
  });

  it('supports undoable Clear Notes, Discard edits, and Sign Out unsaved confirmation guard', async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByLabelText('General Medical Notes')).toHaveValue('Ring bell twice');
    });

    // Clear Notes fires undo toast and Undo restores previous text
    fireEvent.click(screen.getByRole('button', { name: /Clear Notes/i }));
    expect(screen.getByLabelText('General Medical Notes')).toHaveValue('');
    expect(toastMock).toHaveBeenCalledTimes(1);

    const toastRenderer = toastMock.mock.calls[0][0];
    const toastUi = render(toastRenderer({ id: 'clear-undo-1' }));
    fireEvent.click(toastUi.getByRole('button', { name: /Undo/i }));
    toastUi.unmount();

    expect(screen.getByLabelText('General Medical Notes')).toHaveValue('Ring bell twice');
    expect(toastMock.dismiss).toHaveBeenCalledWith('clear-undo-1');

    // Edit phone -> Discard restores saved baseline
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '09999999999' } });
    expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Discard$/i }));
    expect(screen.getByLabelText('Phone Number')).toHaveValue('09171234567');
    expect(screen.getByText('All profile changes saved')).toBeInTheDocument();

    // Edit phone -> Sign Out triggers confirmation dialog instead of logging out silently
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '09170000000' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign Out$/i }));
    expect(logoutMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Discard Unsaved Changes & Sign Out\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Discard & Sign Out/i }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('connects Medical labels & chips and deletes Documents via in-app confirmation modal without window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderProfile();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Medical/i })).toBeInTheDocument();
    });

    switchTab(/Medical/i);

    const allergiesInput = await screen.findByLabelText('Known Allergies');
    expect(allergiesInput).toHaveValue('Shellfish');
    expect(screen.getByLabelText('Chronic Conditions')).toHaveValue('Hypertension');
    expect(screen.getByLabelText('Past Surgeries or Procedures')).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: /\+ Penicillin/i }));
    expect(allergiesInput).toHaveValue('Shellfish, Penicillin');

    switchTab(/Documents/i);

    const deleteTrigger = await screen.findByRole('button', { name: 'Delete Lab_Result.pdf' });
    fireEvent.click(deleteTrigger);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Delete Medical Document?')).toBeInTheDocument();
    expect(screen.getByText(/"Lab_Result\.pdf" will be permanently deleted/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Delete Permanently/i }));

    await waitFor(() => {
      expect(supabaseMock.storageRemoveMock).toHaveBeenCalledWith(['patient-1/lab.pdf']);
      expect(supabaseMock.deleteDocEqMock).toHaveBeenCalledWith('id', 'doc-1');
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Delete Lab_Result.pdf' })).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });
});
