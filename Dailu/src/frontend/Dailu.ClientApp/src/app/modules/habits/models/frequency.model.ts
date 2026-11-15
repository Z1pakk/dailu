import { FrequencyType } from '@habits/enums/frequency-type.enum';
import { DayOfWeek } from '@habits/enums/day-of-week.enum';

export interface FrequencyModel {
  type: FrequencyType;
  /** Weekly only; empty = N times a week, any days. */
  weekDays: DayOfWeek[];
  /** Monthly only, 1–31 (29–31 fall on the last day of shorter months); empty = N times a month, any days. */
  monthDays: number[];
  /** Sessions per week/month when no days are picked; always 1 otherwise. */
  timesPerPeriod: number;
}
