import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import FhirExportModal from './FhirExportModal';
import FhirImportModal from './FhirImportModal';
import { buildIpsBundle } from '@/lib/fhir';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FhirExportModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('displays IPS validation status, resource list including Documents, and copies serialized JSON', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const bundle = buildIpsBundle({
      userData: { id: 'p-ui-1', full_name: 'Elena Dela Cruz', email: 'elena@example.ph' },
      patientData: { phone: '09171234567', date_of_birth: '1958-06-14' },
      medicalHistory: {
        allergies: 'Penicillin',
        chronic_conditions: 'Hypertension',
        medications: 'Amlodipine 5mg once daily',
      },
      documents: [
        { id: 'doc-1', document_title: 'Lab_CBC.pdf', uploaded_at: '2026-11-10T08:00:00Z' },
      ],
    });

    render(
      <FhirExportModal
        open
        onClose={vi.fn()}
        bundle={bundle}
        patientName="Elena Dela Cruz"
      />
    );

    expect(screen.getByText('FHIR R4 Patient Summary')).toBeInTheDocument();
    expect(screen.getByText('Valid HL7 FHIR R4 Bundle')).toBeInTheDocument();
    expect(screen.getByText('8/8 checks passed')).toBeInTheDocument();
    expect(screen.getByText('MuntiCares International Patient Summary')).toBeInTheDocument();
    expect(screen.getByText('Lab_CBC.pdf')).toBeInTheDocument();
    expect(screen.getByText('Demographics & contact')).toBeInTheDocument();
    expect(screen.getByText('Uploaded medical document')).toBeInTheDocument();

    expect(screen.queryByText(/\bIPS\b/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Close FHIR dialog/i })).not.toBeInTheDocument();

    expect(screen.queryByText('Patient/p-ui-1')).not.toBeInTheDocument();
    expect(screen.queryByText('Organization/munticares-org')).not.toBeInTheDocument();
    expect(screen.queryByText('HL7 R4 IPS')).not.toBeInTheDocument();
    expect(screen.queryByText('Demographics')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Raw JSON Payload/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copy JSON/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const copiedJson = writeText.mock.calls[0][0];
    expect(copiedJson).toContain('"resourceType": "Bundle"');
    expect(copiedJson).toContain('"type": "document"');
  });

  it('shows skeleton loading state and disables actions while exporting FHIR data', () => {
    render(
      <FhirExportModal
        open
        loading
        onClose={vi.fn()}
        bundle={null}
        patientName="Elena Dela Cruz"
      />
    );

    expect(screen.getByText('FHIR R4 Patient Summary')).toBeInTheDocument();
    expect(screen.getByText('Preparing patient summary...')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /Preparing patient summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy JSON/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Preparing JSON/i })).toBeDisabled();
  });
});

describe('FhirImportModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads the synthetic hospital discharge fixture, displays clinical diffs, and merges selected categories', async () => {
    const sampleJson = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'public/samples/sample-hospital-discharge-ips.json'),
        'utf8'
      )
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleJson,
      })
    );

    const onConfirmMerge = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <FhirImportModal
        open
        onClose={onClose}
        currentProfile={{
          phone: '09170000000',
          allergies: 'Shellfish',
          chronic_conditions: '',
          medications: '',
          past_surgeries: '',
          blood_type: '',
          medical_notes: '',
        }}
        onConfirmMerge={onConfirmMerge}
      />
    );

    expect(screen.queryByRole('button', { name: /Close FHIR import dialog/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\bIPS\b/)).not.toBeInTheDocument();
    expect(screen.getByText('Parsed locally')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Load Synthetic Demo Record/i }));

    await waitFor(() => {
      expect(screen.getByText('Valid HL7 FHIR R4 Bundle')).toBeInTheDocument();
    });

    expect(screen.getByText(/Sample Metro Discharge Clinic/i)).toBeInTheDocument();
    expect(screen.getByText('Known Allergies')).toBeInTheDocument();
    expect(screen.getByText('Current Medications')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Merge/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onConfirmMerge).toHaveBeenCalledTimes(1);
    });

    const [merged] = onConfirmMerge.mock.calls[0];
    expect(merged.medicalHistoryPatch.allergies).toBe('Shellfish, Penicillin');
    expect(merged.medicalHistoryPatch.blood_type).toBe('O+');
    expect(onClose).toHaveBeenCalled();
  });
});
