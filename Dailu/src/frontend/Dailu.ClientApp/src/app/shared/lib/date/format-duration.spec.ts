import { formatDuration } from './format-duration';

describe('formatDuration', () => {
  it('should format hours and minutes', () => {
    expect(formatDuration(468)).toBe('7 h 48 m');
    expect(formatDuration(45)).toBe('45 m');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(0)).toBe('0 m');
  });
});
