import { isWeekend } from 'date-fns/isWeekend';
import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { isWeekdays } from '@habits/lib/habit-schedule';
import { localDay } from '@shared/lib/date/local-day';

/*
 * "Any time today": habits without a time of day that are due today. Habits have no
 * times yet, so every real habit is an any-time habit. Positions use the same
 * 06:00 → 24:00 scale as the clock timeline.
 */

export interface LaneItem {
  id: string;
  name: string;
  isDone: boolean;
  /** 0..1 on the 06:00 → 24:00 scale: when it was ticked, or "now" while open. */
  position: number;
}

export interface AnyTimeLane {
  items: LaneItem[];
  done: number;
  total: number;
  minutesLeft: number;
  nowPosition: number;
}

const DAY_START_H = 6;
const DAY_LENGTH_H = 18;

export function dayPosition(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  return Math.min(1, Math.max(0, (hours - DAY_START_H) / DAY_LENGTH_H));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) {
    return `${h} h ${m} m`;
  }
  if (h > 0) {
    return `${h} h`;
  }
  return `${m} m`;
}

function ownEntries(habit: HabitModel, entries: readonly HabitEntryModel[]): HabitEntryModel[] {
  return entries.filter((e) => !e.isArchived && e.habitId === habit.id);
}

/** Entries of the habit in the period (week from Monday, or month) that contains `today`. */
function periodEntries(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): HabitEntryModel[] {
  const day = parseISO(today);
  const start =
    habit.frequency.type === frequencyTypes.monthly ? startOfMonth(day) : startOfWeek(day, { weekStartsOn: 1 });
  const from = localDay(start);
  return ownEntries(habit, entries).filter((e) => {
    const d = localDay(e.completedAtUtc);
    return d >= from && d <= today;
  });
}

function entriesOn(habit: HabitModel, entries: readonly HabitEntryModel[], day: string): HabitEntryModel[] {
  return ownEntries(habit, entries).filter((e) => localDay(e.completedAtUtc) === day);
}

export function isDueToday(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): boolean {
  if (habit.isArchived || habit.status === habitStatuses.completed) {
    return false;
  }
  if (habit.frequency.type === frequencyTypes.daily) {
    return true;
  }
  if (isWeekdays(habit.frequency)) {
    return !isWeekend(parseISO(today));
  }
  // Custom weekly / monthly: due until the period's target is met — and still shown on the day it was met.
  const before = periodEntries(habit, entries, today).filter((e) => localDay(e.completedAtUtc) !== today).length;
  return before < habit.frequency.timesPerPeriod;
}

export function periodProgress(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): number {
  const target = Math.max(1, habit.frequency.timesPerPeriod);
  if (habit.frequency.type === frequencyTypes.daily) {
    return Math.min(1, entriesOn(habit, entries, today).length / target);
  }
  if (isWeekdays(habit.frequency)) {
    return entriesOn(habit, entries, today).length > 0 ? 1 : 0;
  }
  return Math.min(1, periodEntries(habit, entries, today).length / target);
}

export function anyTimeLane(habits: readonly HabitModel[], entries: readonly HabitEntryModel[], now: Date): AnyTimeLane {
  const today = localDay(now);
  const nowPosition = dayPosition(now);
  const due = habits.filter((h) => isDueToday(h, entries, today));
  const done: (LaneItem & { at: number })[] = [];
  const open: LaneItem[] = [];
  for (const habit of due) {
    const todays = entriesOn(habit, entries, today)
      .map((e) => new Date(e.completedAtUtc))
      .sort((a, b) => a.getTime() - b.getTime());
    if (todays.length > 0) {
      done.push({ id: habit.id, name: habit.name, isDone: true, position: dayPosition(todays[0]!), at: todays[0]!.getTime() });
    } else {
      open.push({ id: habit.id, name: habit.name, isDone: false, position: nowPosition });
    }
  }
  done.sort((a, b) => a.at - b.at);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return {
    items: [...done.map(({ id, name, isDone, position }) => ({ id, name, isDone, position })), ...open],
    done: done.length,
    total: due.length,
    minutesLeft: Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 60_000)),
    nowPosition,
  };
}
