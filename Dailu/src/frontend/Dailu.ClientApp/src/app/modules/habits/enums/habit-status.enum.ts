import { ValueOf } from '@shared/lib/types/value-of.type';

export const habitStatuses = {
  none: 0,
  ongoing: 1,
  completed: 2,
} as const;

export type HabitStatus = ValueOf<typeof habitStatuses>;
