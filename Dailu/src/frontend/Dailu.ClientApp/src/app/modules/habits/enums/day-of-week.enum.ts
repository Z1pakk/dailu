import { ValueOf } from '@shared/lib/types/value-of.type';

/** Same numbering as .NET DayOfWeek, Date.getDay() and date-fns getDay. */
export const daysOfWeek = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const;

export type DayOfWeek = ValueOf<typeof daysOfWeek>;

export const dayOfWeekShortLabels: Record<DayOfWeek, string> = {
  [daysOfWeek.sunday]: 'Sun',
  [daysOfWeek.monday]: 'Mon',
  [daysOfWeek.tuesday]: 'Tue',
  [daysOfWeek.wednesday]: 'Wed',
  [daysOfWeek.thursday]: 'Thu',
  [daysOfWeek.friday]: 'Fri',
  [daysOfWeek.saturday]: 'Sat',
};

/** Order of the drawer's buttons: Monday first. */
export const weekButtonOrder: readonly DayOfWeek[] = [
  daysOfWeek.monday,
  daysOfWeek.tuesday,
  daysOfWeek.wednesday,
  daysOfWeek.thursday,
  daysOfWeek.friday,
  daysOfWeek.saturday,
  daysOfWeek.sunday,
];

/** "Weekdays" = Weekly with exactly these days picked. */
export const workWeek: readonly DayOfWeek[] = [
  daysOfWeek.monday,
  daysOfWeek.tuesday,
  daysOfWeek.wednesday,
  daysOfWeek.thursday,
  daysOfWeek.friday,
];
