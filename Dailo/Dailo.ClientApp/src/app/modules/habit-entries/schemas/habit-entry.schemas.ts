import * as v from 'valibot';
import { notBlankOptional } from '@shared/lib/form/not-blank';

export const HabitEntryHabitIdSchema = v.pipe(
  v.string(),
  v.nonEmpty('Habit is required'),
);

export const HabitEntryValueSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0, 'Value must be greater than or equal to 0'),
  v.maxValue(99999, 'Value must be less than 99999'),
);

export const HabitEntryNotesSchema = v.pipe(
  v.string(),
  notBlankOptional(),
  v.maxLength(1000, 'Maximum of 1000 characters'),
);

export const HabitEntryDateSchema = v.pipe(
  v.date(),
  v.check(
    (date) => date <= new Date(new Date().setHours(23, 59, 59, 999)),
    'Date cannot be in the future',
  ),
);