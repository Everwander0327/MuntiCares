import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuditedDocumentUrl } from './documentAccess';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }));

beforeEach(() => invoke.mockReset());

describe('audited provider document links', () => {
  it('requests a fresh server-audited link without supplying actor or timestamp', async () => {
    invoke.mockResolvedValue({ data: { signedUrl: 'https://example.test/file' } });

    await expect(getAuditedDocumentUrl('patient', 'path')).resolves.toBe('https://example.test/file');
    await getAuditedDocumentUrl('patient', 'path');

    expect(invoke).toHaveBeenCalledWith('medical-document-link', {
      body: { patientId: 'patient', filePath: 'path' },
    });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('propagates endpoint failures and rejects missing links', async () => {
    invoke.mockResolvedValueOnce({ error: new Error('audit unavailable') });
    await expect(getAuditedDocumentUrl('patient', 'path')).rejects.toThrow('audit unavailable');

    invoke.mockResolvedValueOnce({ data: {} });
    await expect(getAuditedDocumentUrl('patient', 'path')).rejects.toThrow('Document link unavailable');
  });

  it('rejects missing inputs before requesting a link', async () => {
    await expect(getAuditedDocumentUrl('', 'path')).rejects.toThrow('Missing document details');
    expect(invoke).not.toHaveBeenCalled();
  });
});
