import { describe, it, expect } from 'vitest';
import { formatFullVisitAddress, parseFullVisitAddress } from '../services/addressFormat';

describe('formatFullVisitAddress', () => {
  it('formats full delivery address with all fields', () => {
    const formatted = formatFullVisitAddress({
      unit: 'Unit 402, 4th Floor',
      subdivision: 'Victoria Homes Phase 2, Gate 1',
      baseAddress: 'Sampaguita St., Brgy. Tunasan, Muntinlupa City',
      instructions: 'Yellow gate. Tell guard visiting Santos residence.',
    });

    expect(formatted).toBe(
      'Unit 402, 4th Floor, Victoria Homes Phase 2, Gate 1, Sampaguita St., Brgy. Tunasan, Muntinlupa City (Gate/Notes: Yellow gate. Tell guard visiting Santos residence.)'
    );
  });

  it('formats address without optional unit and instructions', () => {
    const formatted = formatFullVisitAddress({
      baseAddress: 'Ayala Alabang Village, Muntinlupa City',
    });

    expect(formatted).toBe('Ayala Alabang Village, Muntinlupa City');
  });

  it('formats address with subdivision and instructions but no unit', () => {
    const formatted = formatFullVisitAddress({
      subdivision: 'Soldier\'s Hills',
      baseAddress: 'Brgy. Putatan, Muntinlupa City',
      instructions: 'Call when at gate',
    });

    expect(formatted).toBe(
      'Soldier\'s Hills, Brgy. Putatan, Muntinlupa City (Gate/Notes: Call when at gate)'
    );
  });

  it('trims extraneous whitespace from fields', () => {
    const formatted = formatFullVisitAddress({
      unit: '   Room 3B  ',
      baseAddress: ' Civic Prime  ',
      instructions: '  Ring buzzer  ',
    });

    expect(formatted).toBe('Room 3B, Civic Prime (Gate/Notes: Ring buzzer)');
  });

  it('returns null if all fields are empty or whitespace', () => {
    const formatted = formatFullVisitAddress({
      unit: '   ',
      subdivision: '',
      baseAddress: '  ',
      instructions: '',
    });

    expect(formatted).toBeNull();
  });
});

describe('parseFullVisitAddress', () => {
  it('parses address containing gate notes', () => {
    const parsed = parseFullVisitAddress(
      'Unit 402, Victoria Homes, Tunasan (Gate/Notes: Yellow gate, ring bell)'
    );

    expect(parsed.instructions).toBe('Yellow gate, ring bell');
    expect(parsed.baseAddress).toBe('Unit 402, Victoria Homes, Tunasan');
  });

  it('parses standard address without notes', () => {
    const parsed = parseFullVisitAddress('Alabang Town Center, Muntinlupa');
    expect(parsed.instructions).toBe('');
    expect(parsed.baseAddress).toBe('Alabang Town Center, Muntinlupa');
  });

  it('handles empty or invalid address gracefully', () => {
    expect(parseFullVisitAddress(null)).toEqual({
      unit: '',
      subdivision: '',
      baseAddress: '',
      instructions: '',
    });
  });
});
