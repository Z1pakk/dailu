import { addDays } from 'date-fns/addDays';
import { addMonths } from 'date-fns/addMonths';
import { addWeeks } from 'date-fns/addWeeks';
import { isWeekend } from 'date-fns/isWeekend';
import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { automationSources } from '@habits/enums/automation-source.enum';
import { localDay } from '@shared/lib/date/local-day';
import { isWeekdays } from '@habits/lib/habit-schedule';

/*
 * Per-habit progress for the habits list. Days are local calendar days
 * ('yyyy-MM-dd'), weeks start on Monday and archived entries never count.
 */

export type HabitFilter = 'all' | 'auto' | 'manual';

export interface HabitCounts {
  all: number;
  auto: number;
  manual: number;
}

export type DotState = 'done' | 'missed' | 'open' | 'future';

export interface WeekDot {
  label: string;
  day: string;
  state: DotState;
}

export interface HabitStreak {
  count: number;
  unit: 'day' | 'week' | 'month';
}

export interface MilestoneProgress {
  current: number;
  target: number;
  percent: number;
  label: string;
}

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const SOURCE_NAMES: Record<number, string> = {
  [automationSources.github]: 'GitHub',
  [automationSources.strava]: 'Strava',
  [automationSources.googleHealth]: 'Google Health',
};

export function isAutomated(habit: HabitModel): boolean {
  return habit.automationSource != null && habit.automationSource !== automationSources.none;
}

/** The integration's name ("Strava"), or "by you" for manual habits. */
export function sourceLabel(habit: HabitModel): string {
  if (!isAutomated(habit)) {
    return 'by you';
  }
  return SOURCE_NAMES[habit.automationSource!]!;
}

export function habitCounts(habits: readonly HabitModel[]): HabitCounts {
  const active = habits.filter((h) => !h.isArchived);
  const auto = active.filter(isAutomated).length;
  return { all: active.length, auto, manual: active.length - auto };
}

export function filterHabits(habits: readonly HabitModel[], filter: HabitFilter): HabitModel[] {
  return habits.filter((h) => {
    if (h.isArchived) {
      return false;
    }
    if (filter === 'all') {
      return true;
    }
    return isAutomated(h) === (filter === 'auto');
  });
}

/** Non-archived entries of one habit, counted per local day. */
function entriesPerDay(habit: HabitModel, entries: readonly HabitEntryModel[]): Map<string, number> {
  const perDay = new Map<string, number>();
  for (const entry of entries) {
    if (entry.isArchived || entry.habitId !== habit.id) {
      continue;
    }
    const day = localDay(entry.completedAtUtc);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return perDay;
}

function createdDay(habit: HabitModel): string {
  return localDay(new Date(habit.createdAtUtc));
}

/** Whether a missed day is meaningful: daily habits expect every day, Weekdays habits Mon–Fri. */
function isExpectedOn(habit: HabitModel, day: string): boolean {
  if (habit.frequency.type === frequencyTypes.daily) {
    return true;
  }
  return isWeekdays(habit.frequency) && !isWeekend(parseISO(day));
}

export function weekDots(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): WeekDot[] {
  const perDay = entriesPerDay(habit, entries);
  const created = createdDay(habit);
  const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  return WEEK_LABELS.map((label, i) => {
    const day = localDay(addDays(monday, i));
    return { label, day, state: dotState(habit, day, today, created, perDay) };
  });
}

function dotState(
  habit: HabitModel,
  day: string,
  today: string,
  created: string,
  perDay: ReadonlyMap<string, number>,
): DotState {
  if (day > today) {
    return 'future';
  }
  if ((perDay.get(day) ?? 0) > 0) {
    return 'done';
  }
  if (day < today && day >= created && isExpectedOn(habit, day)) {
    return 'missed';
  }
  return 'open';
}

interface Period {
  unit: HabitStreak['unit'];
  /** Start (local day) of the period containing `day`. */
  startOf: (day: Date) => Date;
  previous: (start: Date) => Date;
  /** Days that count toward the period; Weekdays habits skip weekends entirely. */
  counts: (day: Date) => boolean;
  needed: number;
}

function periodOf(habit: HabitModel): Period {
  const { type, timesPerPeriod } = habit.frequency;
  if (isWeekdays(habit.frequency)) {
    return {
      unit: 'day',
      startOf: (d) => d,
      previous: (s) => {
        let prev = addDays(s, -1);
        while (isWeekend(prev)) {
          prev = addDays(prev, -1);
        }
        return prev;
      },
      counts: (d) => !isWeekend(d),
      needed: 1,
    };
  }
  if (type === frequencyTypes.weekly) {
    return {
      unit: 'week',
      startOf: (d) => startOfWeek(d, { weekStartsOn: 1 }),
      previous: (s) => addWeeks(s, -1),
      counts: () => true,
      needed: timesPerPeriod,
    };
  }
  if (type === frequencyTypes.monthly) {
    return {
      unit: 'month',
      startOf: startOfMonth,
      previous: (s) => addMonths(s, -1),
      counts: () => true,
      needed: timesPerPeriod,
    };
  }
  return { unit: 'day', startOf: (d) => d, previous: (s) => addDays(s, -1), counts: () => true, needed: timesPerPeriod };
}

export function habitStreak(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): HabitStreak {
  const period = periodOf(habit);
  const perDay = entriesPerDay(habit, entries);
  const created = createdDay(habit);
  const firstStart = localDay(period.startOf(parseISO(created)));

  const reached = (start: Date): boolean => {
    let total = 0;
    const end = localDay(nextStart(period, start));
    for (let d = start; localDay(d) < end; d = addDays(d, 1)) {
      if (period.counts(d)) {
        total += perDay.get(localDay(d)) ?? 0;
      }
    }
    return total >= period.needed;
  };

  let cursor = period.startOf(parseISO(today));
  if (!period.counts(cursor)) {
    // A weekend for a Weekdays habit: start from Friday, which is already over — no grace.
    cursor = period.previous(cursor);
  } else if (!reached(cursor)) {
    // Only the period containing today may still be unfinished without breaking the streak.
    cursor = period.previous(cursor);
  }
  let count = 0;
  while (localDay(cursor) >= firstStart && reached(cursor)) {
    count++;
    cursor = period.previous(cursor);
  }
  return { count, unit: period.unit };
}

/** First day after the period starting at `start`. */
function nextStart(period: Period, start: Date): Date {
  if (period.unit === 'week') {
    return addWeeks(start, 1);
  }
  if (period.unit === 'month') {
    return addMonths(start, 1);
  }
  return addDays(start, 1);
}

export function milestoneProgress(
  habit: HabitModel,
  entries: readonly HabitEntryModel[],
): MilestoneProgress | null {
  const target = habit.milestone?.target ?? 0;
  if (target <= 0) {
    return null;
  }
  // The backend never advances milestone.current, so progress is the entry count.
  const current = entries.filter((e) => !e.isArchived && e.habitId === habit.id).length;
  return {
    current,
    target,
    percent: Math.min(100, Math.round((current / target) * 100)),
    label: `${target} ${habit.target.unit.trim() || 'times'}`,
  };
}
