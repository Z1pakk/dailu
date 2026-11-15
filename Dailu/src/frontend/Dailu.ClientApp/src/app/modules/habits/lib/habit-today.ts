import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { hasFixedDays, hasTime, isScheduledOn, timesPerPeriod } from '@habits/lib/habit-schedule';
import { localDay } from '@shared/lib/date/local-day';

/*
 * "Any time today": habits without a time of day that are due today; timed habits are on the
 * clock instead. Positions use the same 06:00 → 24:00 scale as the clock timeline.
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

/** Local days with at least one entry; a "N times" habit counts at most one session a day. */
function daysWithEntries(entries: readonly HabitEntryModel[]): Set<string> {
  return new Set(entries.map((e) => localDay(e.completedAtUtc)));
}

export function isDueToday(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): boolean {
  if (!isScheduledOn(habit, today)) {
    return false;
  }
  if (hasFixedDays(habit.frequency)) {
    return true;
  }
  // No days picked: due until done on N days this week/month — and still shown on the day it was finished.
  const before = [...daysWithEntries(periodEntries(habit, entries, today))].filter((d) => d !== today).length;
  return before < timesPerPeriod(habit.frequency);
}

export function periodProgress(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): number {
  if (hasFixedDays(habit.frequency)) {
    return entriesOn(habit, entries, today).length > 0 ? 1 : 0;
  }
  const needed = timesPerPeriod(habit.frequency);
  return Math.min(needed, daysWithEntries(periodEntries(habit, entries, today)).size) / needed;
}

export function anyTimeLane(habits: readonly HabitModel[], entries: readonly HabitEntryModel[], now: Date): AnyTimeLane {
  const today = localDay(now);
  const nowPosition = dayPosition(now);
  const due = habits.filter((h) => !hasTime(h) && isDueToday(h, entries, today));
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
