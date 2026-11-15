import { getDay } from 'date-fns/getDay';
import { parseISO } from 'date-fns/parseISO';
import { HabitModel } from '@habits/models/habit.model';
import { FrequencyModel } from '@habits/models/frequency.model';
import { TimingModel } from '@habits/models/timing.model';
import { FrequencyType, frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { DayOfWeek, dayOfWeekShortLabels, weekButtonOrder, workWeek } from '@habits/enums/day-of-week.enum';
import { formatMonthDays, matchesMonthDay, ordinalDay } from '@habits/lib/month-days';
import { localDay } from '@shared/lib/date/local-day';
import { formatTimeOfDay, timeOfDayToMinutes } from '@shared/lib/date/time-of-day';
import { formatDuration } from '@shared/lib/date/format-duration';

/*
 * The habit schedule: when a habit can be done, mirrored from the domain
 * (Frequency.Matches / HabitAggregate.IsScheduledOn). "Scheduled" is pure calendar;
 * whether it's still *due* depends on entries and lives in habit-today.ts.
 */

const PERIOD_NAMES: Partial<Record<FrequencyType, string>> = {
  [frequencyTypes.weekly]: 'week',
  [frequencyTypes.monthly]: 'month',
};

/** Daily, or weekly/monthly with picked days → known days, can have a time, sits on the clock. */
export function hasFixedDays(frequency: FrequencyModel): boolean {
  switch (frequency.type) {
    case frequencyTypes.daily:
      return true;
    case frequencyTypes.weekly:
      return frequency.weekDays.length > 0;
    case frequencyTypes.monthly:
      return frequency.monthDays.length > 0;
    default:
      return false;
  }
}

const MAX_TIMES_PER_PERIOD: Partial<Record<FrequencyType, number>> = {
  [frequencyTypes.weekly]: 7,
  [frequencyTypes.monthly]: 31,
};

/** Upper limit of "N times" for a period type, the same as the domain's (1 for daily). */
export function maxTimesPerPeriod(type: FrequencyType): number {
  return MAX_TIMES_PER_PERIOD[type] ?? 1;
}

/** Sessions needed per week/month: the count for habits without days, 1 for fixed-day ones. */
export function timesPerPeriod(frequency: FrequencyModel): number {
  return hasFixedDays(frequency) ? 1 : Math.max(1, frequency.timesPerPeriod);
}

/** Clock segment length for a habit with a time but no duration. */
export const DEFAULT_CLOCK_SLOT = 30;
const MINUTES_PER_DAY = 24 * 60;

/** Where a timed habit sits on the clock, in minutes since midnight; null without a time. */
export function clockSpan(timing: TimingModel): { start: number; end: number } | null {
  if (timing.at === null) {
    return null;
  }
  const start = timeOfDayToMinutes(timing.at);
  return { start, end: Math.min(MINUTES_PER_DAY, start + (timing.durationMinutes ?? DEFAULT_CLOCK_SLOT)) };
}

export function hasTime(habit: HabitModel): boolean {
  return habit.timing.at !== null;
}

/** Weekly with exactly Mon–Fri picked. */
export function isWeekdays(frequency: FrequencyModel): boolean {
  return (
    frequency.type === frequencyTypes.weekly &&
    frequency.weekDays.length === workWeek.length &&
    workWeek.every((d) => frequency.weekDays.includes(d))
  );
}

/** Mirror of Frequency.Matches: the calendar part only. `day` is 'yyyy-MM-dd', like localDay output. */
export function matchesDay(frequency: FrequencyModel, day: string): boolean {
  switch (frequency.type) {
    case frequencyTypes.daily:
      return true;
    case frequencyTypes.weekly:
      return frequency.weekDays.length === 0 || frequency.weekDays.includes(getDay(parseISO(day)) as DayOfWeek);
    case frequencyTypes.monthly:
      return frequency.monthDays.length === 0 || matchesMonthDay(frequency.monthDays, day);
    default:
      return false;
  }
}

/** Mirror of HabitAggregate.IsScheduledOn. `day` is 'yyyy-MM-dd', like localDay output. */
export function isScheduledOn(habit: HabitModel, day: string): boolean {
  if (day < localDay(new Date(habit.createdAtUtc))) {
    return false;
  }
  if (habit.endDate && day > localDay(habit.endDate)) {
    return false;
  }
  if (habit.isArchived || habit.status === habitStatuses.completed) {
    return false;
  }
  return matchesDay(habit.frequency, day);
}

function weekDayLabels(weekDays: readonly DayOfWeek[]): string {
  return weekButtonOrder
    .filter((d) => weekDays.includes(d))
    .map((d) => dayOfWeekShortLabels[d])
    .join(', ');
}

function timesLabel(frequency: FrequencyModel): string {
  const period = PERIOD_NAMES[frequency.type] ?? 'period';
  return `${timesPerPeriod(frequency)}× a ${period}`;
}

function frequencyLabel(frequency: FrequencyModel): string {
  switch (frequency.type) {
    case frequencyTypes.daily:
      return 'Daily';
    case frequencyTypes.weekly:
      if (isWeekdays(frequency)) {
        return 'Weekdays';
      }
      if (frequency.weekDays.length > 0) {
        return weekDayLabels(frequency.weekDays);
      }
      return timesPerPeriod(frequency) > 1 ? timesLabel(frequency) : 'Weekly';
    case frequencyTypes.monthly: {
      if (frequency.monthDays.length > 0) {
        const days = [...frequency.monthDays]
          .sort((a, b) => a - b)
          .map((d) => (d === 31 ? 'last day' : ordinalDay(d)));
        return `Monthly · ${days.join(', ')}`;
      }
      return timesPerPeriod(frequency) > 1 ? timesLabel(frequency) : 'Monthly';
    }
    default:
      return '';
  }
}

/** List and card label, e.g. "Mon, Wed, Fri · 07:00 · 45 m" or "2× a week · 30 m". */
export function scheduleLabel(habit: HabitModel): string {
  const parts = [frequencyLabel(habit.frequency)];
  if (habit.timing.at !== null) {
    parts.push(formatTimeOfDay(timeOfDayToMinutes(habit.timing.at)));
  }
  if (habit.timing.durationMinutes !== null) {
    parts.push(formatDuration(habit.timing.durationMinutes));
  }
  return parts.join(' · ');
}

/** The drawer's hint under the day picker. */
export function daysHint(frequency: FrequencyModel): string {
  if (frequency.type === frequencyTypes.daily) {
    return 'Every day · amounts go in "At least" below';
  }
  if (frequency.type === frequencyTypes.weekly && frequency.weekDays.length > 0) {
    return isWeekdays(frequency)
      ? 'Weekdays · Mon–Fri'
      : `${weekDayLabels(frequency.weekDays)} · pick Mon–Fri for weekdays`;
  }
  if (frequency.type === frequencyTypes.monthly && frequency.monthDays.length > 0) {
    return `${formatMonthDays(frequency.monthDays)} of every month`;
  }
  const period = PERIOD_NAMES[frequency.type] ?? 'period';
  const times = timesPerPeriod(frequency);
  return times > 1
    ? `No days picked · ${times} times a ${period}, any days`
    : `No days picked · once a ${period}, any day`;
}

/** The drawer's hint under the time controls. */
export function timeHint(frequency: FrequencyModel, timing: TimingModel): string {
  if (!hasFixedDays(frequency)) {
    const period = PERIOD_NAMES[frequency.type] ?? 'period';
    const times = timesPerPeriod(frequency);
    const count = times > 1 ? `${times}× ` : '';
    return `Pick days to set a time · due until done ${count}this ${period}`;
  }
  if (timing.at === null) {
    return 'Due by midnight · not on your clock';
  }
  const start = timeOfDayToMinutes(timing.at);
  if (timing.durationMinutes === null) {
    return `${formatTimeOfDay(start)} · on your clock`;
  }
  return `${formatTimeOfDay(start)}–${formatTimeOfDay(start + timing.durationMinutes)} · on your clock`;
}
