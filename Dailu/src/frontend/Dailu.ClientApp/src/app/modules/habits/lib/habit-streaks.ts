import { addDays } from 'date-fns/addDays';
import { parseISO } from 'date-fns/parseISO';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { streaks } from '@dashboard/lib/dashboard-day';
import { localDay } from '@shared/lib/date/local-day';

/*
 * Two streaks: the partial one (a day counts when at least one habit was done) is the
 * headline, because it is the one people actually keep; the full one (every tracked
 * habit done) is the stricter, secondary number.
 */

export interface StreakRun {
  current: number;
  best: number;
}

export interface StreakSummary {
  partial: StreakRun;
  full: StreakRun;
}

export function partialStreak(entries: readonly HabitEntryModel[], today: string): StreakRun {
  const days = new Set(entries.filter((e) => !e.isArchived).map((e) => localDay(e.completedAtUtc)));
  if (days.size === 0) {
    return { current: 0, best: 0 };
  }

  // Current: walk back from today; an unfinished today doesn't break the streak yet.
  let current = 0;
  let cursor = parseISO(today);
  if (!days.has(today)) {
    cursor = addDays(cursor, -1);
  }
  while (days.has(localDay(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // Best: longest run of consecutive days in the set.
  let best = 0;
  for (const day of days) {
    if (days.has(localDay(addDays(parseISO(day), -1)))) {
      continue; // not the start of a run
    }
    let run = 0;
    for (let d = parseISO(day); days.has(localDay(d)); d = addDays(d, 1)) {
      run++;
    }
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

export function streakSummary(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
  today: string,
): StreakSummary {
  return { partial: partialStreak(entries, today), full: streaks(habits, entries, today) };
}
