import { formatMonthDays, matchesMonthDay, ordinalDay, shortMonthWarning } from './month-days';

describe('month-days', () => {
  describe('matchesMonthDay', () => {
    it('should match picked days', () => {
      expect(matchesMonthDay([1, 15], '2026-11-15')).toBeTrue();
      expect(matchesMonthDay([1, 15], '2026-11-16')).toBeFalse();
    });

    it('should move a missing day to the last day of the month', () => {
      expect(matchesMonthDay([31], '2026-11-30')).toBeTrue();
      expect(matchesMonthDay([31], '2026-11-29')).toBeFalse();
      expect(matchesMonthDay([31], '2026-12-31')).toBeTrue();
      expect(matchesMonthDay([31], '2026-12-30')).toBeFalse();
      expect(matchesMonthDay([30], '2026-02-28')).toBeTrue();
    });

    it('should only move the 29th in non-leap years', () => {
      expect(matchesMonthDay([29], '2026-02-28')).toBeTrue();
      expect(matchesMonthDay([29], '2028-02-28')).toBeFalse();
      expect(matchesMonthDay([29], '2028-02-29')).toBeTrue();
    });

    it('should match the last day once when several days collapse onto it', () => {
      expect(matchesMonthDay([29, 30], '2027-02-28')).toBeTrue();
    });

    it('should not match anything without days', () => {
      expect(matchesMonthDay([], '2026-11-15')).toBeFalse();
    });
  });

  describe('ordinalDay', () => {
    it('should use the right suffix', () => {
      const expected: [number, string][] = [
        [1, '1st'],
        [2, '2nd'],
        [3, '3rd'],
        [4, '4th'],
        [11, '11th'],
        [12, '12th'],
        [13, '13th'],
        [21, '21st'],
        [22, '22nd'],
        [23, '23rd'],
        [31, '31st'],
      ];
      for (const [day, label] of expected) {
        expect(ordinalDay(day)).toBe(label);
      }
    });
  });

  describe('formatMonthDays', () => {
    it('should list days in order', () => {
      expect(formatMonthDays([15, 1, 31])).toBe('1st, 15th and 31st');
      expect(formatMonthDays([1, 15])).toBe('1st and 15th');
      expect(formatMonthDays([1])).toBe('1st');
      expect(formatMonthDays([])).toBe('');
    });
  });

  describe('shortMonthWarning', () => {
    it('should be null when every picked day exists in every month', () => {
      expect(shortMonthWarning([1, 15])).toBeNull();
      expect(shortMonthWarning([28])).toBeNull();
      expect(shortMonthWarning([])).toBeNull();
    });

    it('should name the highest picked day', () => {
      expect(shortMonthWarning([1, 31])).toContain('has a 31st');
      expect(shortMonthWarning([1, 31])).toContain('30 Nov, 28 Feb');
      expect(shortMonthWarning([30])).toContain('has a 30th');
      expect(shortMonthWarning([29])).toContain('non-leap');
      expect(shortMonthWarning([29, 30, 31])).toContain('has a 31st');
    });
  });
});
