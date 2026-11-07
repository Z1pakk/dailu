import { passwordStrength } from './password-strength';

describe('passwordStrength', () => {
  it('should be empty for an empty password', () => {
    expect(passwordStrength('')).toEqual({ level: 0, label: '' });
  });

  it('should be weak below the 6-character minimum', () => {
    expect(passwordStrength('abc')).toEqual({
      level: 1,
      label: 'Weak · use at least 6 characters',
    });
  });

  it('should be medium for letters only', () => {
    expect(passwordStrength('abcdefgh')).toEqual({
      level: 2,
      label: 'Medium · add a number or symbol',
    });
  });

  it('should be strong with a number and a symbol', () => {
    expect(passwordStrength('abcdef1!')).toEqual({ level: 3, label: 'Strong' });
  });

  it('should be strong with a number alone at the minimum length', () => {
    expect(passwordStrength('abcde1').level).toBe(3);
  });

  it('should treat non-Latin letters as letters, not symbols', () => {
    expect(passwordStrength('пароль').level).toBe(2);
    expect(passwordStrength('éééééé').level).toBe(2);
  });

  it('should be strong with a symbol alone', () => {
    expect(passwordStrength('abcdef!').level).toBe(3);
  });
});
