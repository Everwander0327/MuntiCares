import { describe, it, expect } from 'vitest';
import {
  formatFullVisitAddress,
  isCoordinateAddress,
  parseFullVisitAddress,
  splitVisitAddress,
} from './addressFormat';

const compiled = formatFullVisitAddress({
  unit: 'Block 14 Lot 8',
  subdivision: 'Victoria Homes',
  baseAddress: 'Sampaguita St., Brgy. Tunasan, Muntinlupa City',
  instructions: 'Yellow gate beside the bakery',
});

describe('formatFullVisitAddress / parseFullVisitAddress', () => {
  it('round-trips the gate notes', () => {
    expect(compiled).toBe(
      'Block 14 Lot 8, Victoria Homes, Sampaguita St., Brgy. Tunasan, Muntinlupa City (Gate/Notes: Yellow gate beside the bakery)'
    );
    const parsed = parseFullVisitAddress(compiled);
    expect(parsed.instructions).toBe('Yellow gate beside the bakery');
    expect(parsed.baseAddress).toContain('Sampaguita St.');
  });
});

describe('splitVisitAddress', () => {
  it('removes structured unit and subdivision from the compiled address', () => {
    const parts = splitVisitAddress(compiled, { unit: 'Block 14 Lot 8', subdivision: 'Victoria Homes' });
    expect(parts).toEqual({
      unit: 'Block 14 Lot 8',
      subdivision: 'Victoria Homes',
      baseAddress: 'Sampaguita St., Brgy. Tunasan, Muntinlupa City',
      instructions: 'Yellow gate beside the bakery',
    });
  });

  it('does not resurrect stale structured values when the address was edited elsewhere', () => {
    const parts = splitVisitAddress('12 Mabini St., Brgy. Poblacion, Muntinlupa City', {
      unit: 'Block 14 Lot 8',
      subdivision: 'Victoria Homes',
    });
    expect(parts).toEqual({
      unit: '',
      subdivision: '',
      baseAddress: '12 Mabini St., Brgy. Poblacion, Muntinlupa City',
      instructions: '',
    });
  });

  it('splits only the unit when no subdivision is stored', () => {
    const parts = splitVisitAddress('Block 14 Lot 8, Sampaguita St., Muntinlupa City', { unit: 'Block 14 Lot 8' });
    expect(parts.unit).toBe('Block 14 Lot 8');
    expect(parts.baseAddress).toBe('Sampaguita St., Muntinlupa City');
  });
});

describe('isCoordinateAddress', () => {
  it('detects coordinate-only strings', () => {
    expect(isCoordinateAddress('14.40123, 121.04150')).toBe(true);
    expect(isCoordinateAddress('-14.4, 121.04')).toBe(true);
    expect(isCoordinateAddress(' 14.40123 , 121.04150 ')).toBe(true);
  });

  it('accepts real addresses', () => {
    expect(isCoordinateAddress('Sampaguita St., Muntinlupa City')).toBe(false);
    expect(isCoordinateAddress('14.40123')).toBe(false);
    expect(isCoordinateAddress('')).toBe(false);
  });
});
