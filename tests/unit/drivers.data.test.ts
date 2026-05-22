import { DRIVERS } from '@/data/drivers';

describe('DRIVERS data', () => {
  it('includes unassigned and at least one PIN driver', () => {
    expect(DRIVERS.some((d) => d.role === 'unassigned')).toBe(true);
    expect(DRIVERS.some((d) => d.requiresPin)).toBe(true);
  });

  it('has unique ids', () => {
    const ids = DRIVERS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
