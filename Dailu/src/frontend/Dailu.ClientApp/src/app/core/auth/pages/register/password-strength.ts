export interface PasswordStrength {
  /** 0 = empty, 1 = weak, 2 = medium, 3 = strong — also the number of filled meter bars. */
  level: 0 | 1 | 2 | 3;
  label: string;
}

/** Matches RegisterPasswordSchema's minimum length. */
const MIN_LENGTH = 6;

/** Register page password meter (Figma `32:774`). */
export function passwordStrength(value: string): PasswordStrength {
  if (value.length === 0) {
    return { level: 0, label: '' };
  }
  if (value.length < MIN_LENGTH) {
    return { level: 1, label: 'Weak · use at least 6 characters' };
  }
  // Anything that isn't a letter in any script counts as a number or symbol.
  if (/\P{L}/u.test(value)) {
    return { level: 3, label: 'Strong' };
  }
  return { level: 2, label: 'Medium · add a number or symbol' };
}
