import * as v from 'valibot';
import { notBlank } from '@shared/lib/form/not-blank';

export const TagNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Name is required'),
  notBlank(),
  v.maxLength(100, 'Maximum of 100 characters'),
);
