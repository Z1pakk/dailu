import * as v from 'valibot';

export const notBlank = (message = 'Cannot be only whitespace') =>
  v.check((s: string) => s.trim().length > 0, message);

export const notBlankOptional = (message = 'Cannot be only whitespace') =>
  v.check((s: string) => s === '' || s.trim().length > 0, message);
