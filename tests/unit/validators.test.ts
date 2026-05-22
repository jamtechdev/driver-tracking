import {
  isValidEmail,
  isValidPin,
  isValidDriverId,
  isValidPassengerCount,
} from '@/utils/validators';

describe('validators', () => {
  describe('isValidEmail', () => {
    it('accepts a typical email', () => {
      expect(isValidEmail('driver@example.com')).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
    });
  });

  describe('isValidPin', () => {
    it('accepts 4–6 digits', () => {
      expect(isValidPin('1234')).toBe(true);
      expect(isValidPin('123456')).toBe(true);
    });

    it('rejects wrong lengths or non-digits', () => {
      expect(isValidPin('123')).toBe(false);
      expect(isValidPin('1234567')).toBe(false);
      expect(isValidPin('12ab')).toBe(false);
    });
  });

  describe('isValidDriverId', () => {
    it('enforces length bounds', () => {
      expect(isValidDriverId('ab')).toBe(false);
      expect(isValidDriverId('abc')).toBe(true);
      expect(isValidDriverId('a'.repeat(20))).toBe(true);
      expect(isValidDriverId('a'.repeat(21))).toBe(false);
    });
  });

  describe('isValidPassengerCount', () => {
    it('allows 0–999', () => {
      expect(isValidPassengerCount(0)).toBe(true);
      expect(isValidPassengerCount(999)).toBe(true);
    });

    it('rejects out of range', () => {
      expect(isValidPassengerCount(-1)).toBe(false);
      expect(isValidPassengerCount(1000)).toBe(false);
    });
  });
});
