import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

const { canOverrideArrival, ARRIVAL_OVERRIDE_REASON } = await import('../services/trackingService');
const { default: ArrivalOverrideDialog } = await import('../components/ArrivalOverrideDialog');

describe('arrival override gating', () => {
  it('allows an override for GPS-only failures', () => {
    ['too_far', 'low_accuracy', 'stale_location', 'no_location'].forEach((reason) => {
      expect(canOverrideArrival({ ok: false, reason })).toBe(true);
    });
  });

  it('does not allow an override for state or authorization failures', () => {
    ['not_on_the_way', 'not_allowed', 'no_destination', 'unauthenticated', 'request_not_found'].forEach((reason) => {
      expect(canOverrideArrival({ ok: false, reason })).toBe(false);
    });
    expect(canOverrideArrival(null)).toBe(false);
    expect(canOverrideArrival(undefined)).toBe(false);
  });

  it('sends a fixed, auditable reason', () => {
    expect(ARRIVAL_OVERRIDE_REASON).toBe('Provider confirmed on site (GPS unavailable or inaccurate)');
  });
});

describe('ArrivalOverrideDialog', () => {
  it('explains the GPS cause and confirms on request', () => {
    const onConfirm = vi.fn();
    render(
      <ArrivalOverrideDialog
        open
        failure={{ ok: false, reason: 'low_accuracy', accuracy_m: 212 }}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByText("Confirm you are at the patient's home")).toBeInTheDocument();
    expect(screen.getByText(/only accurate to ±212 m/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Yes, I am on site/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('reports distance instead of accuracy when the provider is too far', () => {
    render(
      <ArrivalOverrideDialog
        open
        failure={{ ok: false, reason: 'too_far', distance_m: 212.4 }}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText(/212 m from the visit location/)).toBeInTheDocument();
  });
});
