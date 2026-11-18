import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
import ProviderVerificationBanner from '@/features/provider/components/ProviderVerificationBanner';
import {
  parseStepParam,
  parseServiceList,
  toggleServiceItem,
  buildProviderOnboardingDraft,
  loadProviderOnboardingDraft,
  clearProviderOnboardingDraft,
  getProviderDraftKey,
  validateIdFile,
  validateProviderStep,
} from './providerOnboarding';

const createMemoryStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

const identityT = (key, params = {}) => {
  if (key === 'provider.onboarding.stepCounter') {
    return `Step ${params.step} of ${params.total}`;
  }
  return key;
};

describe('providerOnboarding helpers', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    });
  });

  it('validates URL step parameters and falls back safely to step 1', () => {
    expect(parseStepParam(null)).toBe(1);
    expect(parseStepParam('0')).toBe(1);
    expect(parseStepParam('99')).toBe(1);
    expect(parseStepParam('4')).toBe(4);
  });

  it('parses and toggles clinical services without case duplicates', () => {
    expect(parseServiceList('Wound Care, wound care , IV Therapy,')).toEqual([
      'Wound Care',
      'IV Therapy',
    ]);
    const added = toggleServiceItem(['Wound Care'], 'Elderly Care');
    expect(added).toEqual(['Wound Care', 'Elderly Care']);
    const removed = toggleServiceItem(added, 'wound care');
    expect(removed).toEqual(['Elderly Care']);
  });

  it('validates steps 1 to 5 accurately without requiring spoken languages', () => {
    const step1Fail = validateProviderStep(
      1,
      { fullName: '', phone: '123', bio: 'Short' },
      identityT
    );
    expect(Object.keys(step1Fail)).toEqual(['fullName', 'phone', 'bio']);

    const step1Pass = validateProviderStep(
      1,
      {
        fullName: 'Nurse Elena Santos',
        phone: '09171234567',
        bio: 'Registered Nurse with 6 years of home care in Alabang.',
      },
      identityT
    );
    expect(step1Pass).toEqual({});

    const step2Fail = validateProviderStep(
      2,
      { coords: null, baseAddress: '', serviceRadiusKm: 150 },
      identityT
    );
    expect(step2Fail).toHaveProperty('coords');
    expect(step2Fail).toHaveProperty('serviceRadiusKm');

    const step3Fail = validateProviderStep(3, { services: [] }, identityT);
    expect(step3Fail).toHaveProperty('services');

    const step4Fail = validateProviderStep(
      4,
      { licenseNumber: '', idFile: null, existingIdPaths: [] },
      identityT
    );
    expect(step4Fail).toHaveProperty('licenseNumber');
    expect(step4Fail).toHaveProperty('idFile');

    const validFile = { name: 'prc.jpg', type: 'image/jpeg', size: 1024 * 500 };
    expect(
      validateProviderStep(
        4,
        { licenseNumber: 'PRC-0123456', idFile: validFile, existingIdPaths: [] },
        identityT
      )
    ).toEqual({});

    expect(validateProviderStep(5, { privacyConsent: false }, identityT)).toHaveProperty(
      'consent'
    );
  });

  it('rejects oversized or unsupported ID uploads', () => {
    expect(
      validateIdFile({ type: 'application/x-msdownload', size: 1024 }, identityT)
    ).toBe('provider.onboarding.errIdFileType');
    expect(
      validateIdFile({ type: 'application/pdf', size: 6 * 1024 * 1024 }, identityT)
    ).toBe('provider.onboarding.errIdFileSize');
  });

  it('persists, restores, and expires localStorage drafts cleanly', () => {
    expect(buildProviderOnboardingDraft()).toBeNull();
    const draft = buildProviderOnboardingDraft({
      fullName: 'Nurse Elena',
      phone: '+63 917 123 4567',
      bio: 'Post-op care',
      serviceRadiusKm: 15,
      services: ['Wound Care'],
    });
    expect(draft).not.toBeNull();
    window.localStorage.setItem(
      getProviderDraftKey('prov-1'),
      JSON.stringify({ savedAt: Date.now(), data: draft })
    );
    expect(loadProviderOnboardingDraft('prov-1')?.serviceRadiusKm).toBe(15);

    window.localStorage.setItem(
      getProviderDraftKey('prov-expired'),
      JSON.stringify({ savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, data: draft })
    );
    expect(loadProviderOnboardingDraft('prov-expired')).toBeNull();

    clearProviderOnboardingDraft('prov-1');
    expect(loadProviderOnboardingDraft('prov-1')).toBeNull();
  });
});

describe('ProviderVerificationBanner', () => {
  const wrap = (ui) =>
    render(
      <MemoryRouter>
        <LanguageProvider>{ui}</LanguageProvider>
      </MemoryRouter>
    );

  it('renders nothing once provider is approved or while loading', () => {
    const { container: loadingRender } = wrap(<ProviderVerificationBanner loading={true} />);
    expect(loadingRender.innerHTML).toBe('');

    const { container: approvedRender } = wrap(
      <ProviderVerificationBanner loading={false} isApproved={true} isProfileComplete={true} />
    );
    expect(approvedRender.innerHTML).toBe('');
  });

  it('shows incomplete onboarding CTA when profile is incomplete', () => {
    wrap(
      <ProviderVerificationBanner
        loading={false}
        isApproved={false}
        isProfileComplete={false}
        professionalIdStatus="none"
      />
    );
    expect(screen.getByText('Finish provider onboarding')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Complete onboarding/i }).getAttribute('href')).toBe(
      '/provider/onboarding'
    );
  });

  it('shows pending review status after onboarding submission', () => {
    wrap(
      <ProviderVerificationBanner
        loading={false}
        isApproved={false}
        isProfileComplete={true}
        professionalIdStatus="pending"
      />
    );
    expect(screen.getByText('Account verification pending')).toBeTruthy();
  });

  it('shows ID re-upload link when ID is rejected', () => {
    wrap(
      <ProviderVerificationBanner
        loading={false}
        isApproved={false}
        isProfileComplete={true}
        professionalIdStatus="rejected"
      />
    );
    expect(screen.getByText('Professional ID needs re-upload')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Upload new ID/i }).getAttribute('href')).toBe(
      '/provider/onboarding?step=4'
    );
  });
});
