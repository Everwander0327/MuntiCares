import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuditedDocumentUrl } from './documentAccess';
const { sign, rpc } = vi.hoisted(() => ({ sign: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: {
  storage: { from: () => ({ createSignedUrl: sign }) }, rpc,
} }));
beforeEach(() => { vi.clearAllMocks(); });
describe('audited provider document links', () => {
  it('records every successful link request and sends no caller-controlled actor or timestamp', async () => {
    sign.mockResolvedValue({ data: { signedUrl: 'https://example.test/file' } });
    rpc.mockResolvedValue({ data: 'event-id' });
    await expect(getAuditedDocumentUrl('patient','path')).resolves.toBe('https://example.test/file');
    expect(rpc).toHaveBeenCalledWith('record_document_access', { p_patient_id: 'patient', p_file_path: 'path' });
    await getAuditedDocumentUrl('patient','path');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('does not log a failed link request', async () => {
    sign.mockResolvedValue({ error: new Error('denied') });
    await expect(getAuditedDocumentUrl('patient','path')).rejects.toThrow('denied');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not release a link when logging fails', async () => {
    sign.mockResolvedValue({ data: { signedUrl: 'https://example.test/file' } });
    rpc.mockResolvedValue({ error: new Error('audit unavailable') });
    await expect(getAuditedDocumentUrl('patient','path')).rejects.toThrow('audit unavailable');
  });
});
