import { addDays } from 'date-fns/addDays';
import { parseISO } from 'date-fns/parseISO';
import { startOfWeek } from 'date-fns/startOfWeek';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { TimingModel } from '@habits/models/timing.model';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { ClockHabit, HabitSource, SOURCE_NAMES } from '@shared/ui/day-clock/day-clock.model';
import { localDay } from '@shared/lib/date/local-day';
import { formatTimeOfDay } from '@shared/lib/date/time-of-day';
import { milestoneProgress } from '@habits/lib/habit-progress';
import { clockSpan, hasFixedDays, isScheduledOn } from '@habits/lib/habit-schedule';

/*
 * Dashboard day maths. Only fixed-day habits are "tracked" (daily, or weekly / monthly with
 * picked days), and only on the days they're scheduled on. Habits without days ("2× a week")
 * have no per-day expectation, so they never make a day incomplete.
 * Days are local calendar days as 'yyyy-MM-dd'.
 */

export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening';

export interface TodayHabit {
  id: string;
  name: string;
  isDone: boolean;
  isAutomated: boolean;
  source: HabitSource;
  /** "Strava", "by you" once checked manually, or "" while still open. */
  sourceLabel: string;
  timing: TimingModel;
}

export interface StreakSummary {
  current: number;
  best: number;
}

export interface WeekDay {
  label: string;
  day: string;
  done: number;
  /** How many of `done` were checked by an integration (the rest by the user). */
  auto: number;
  total: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface MilestoneView {
  habitId: string;
  name: string;
  current: number;
  target: number;
  percent: number;
  isUnlocked: boolean;
}

const SOURCES: Partial<Record<AutomationSource, { name: string; source: HabitSource }>> = {
  [automationSources.github]: { name: 'GitHub', source: 'github' },
  [automationSources.strava]: { name: 'Strava', source: 'strava' },
  [automationSources.googleHealth]: { name: 'Google Health', source: 'google-health' },
};


const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export { localDay };

export function greeting(now: Date): Greeting {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }
  if (hour >= 12 && hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function trackedHabits(habits: readonly HabitModel[]): HabitModel[] {
  return habits.filter(
    (h) =>
      !h.isArchived &&
      h.status === habitStatuses.ongoing &&
      hasFixedDays(h.frequency),
  );
}

function automation(habit: HabitModel): { name: string; source: HabitSource } | null {
  if (!habit.automationSource) {
    return null;
  }
  return SOURCES[habit.automationSource] ?? null;
}

/** Habit ids with at least one non-archived entry, per local day. */
function doneByDay(
  entries: readonly HabitEntryModel[],
  keep: (entry: HabitEntryModel) => boolean = () => true,
): Map<string, Set<string>> {
  const byDay = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (entry.isArchived || !keep(entry)) {
      continue;
    }
    const day = localDay(entry.completedAtUtc);
    let ids = byDay.get(day);
    if (!ids) {
      ids = new Set();
      byDay.set(day, ids);
    }
    ids.add(entry.habitId);
  }
  return byDay;
}

function dayProgress(
  day: string,
  habits: readonly HabitModel[],
  done: ReadonlyMap<string, Set<string>>,
): { done: number; total: number } {
  const ids = done.get(day);
  const scheduled = habits.filter((h) => isScheduledOn(h, day));
  return {
    done: scheduled.filter((h) => ids?.has(h.id)).length,
    total: scheduled.length,
  };
}

export function todayHabits(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
  today: string,
): TodayHabit[] {
  const doneToday = doneByDay(entries).get(today);
  return trackedHabits(habits)
    .filter((habit) => isScheduledOn(habit, today))
    .map((habit) => {
    const isDone = doneToday?.has(habit.id) ?? false;
    const auto = automation(habit);
    let sourceLabel = '';
    if (auto) {
      sourceLabel = auto.name;
    } else if (isDone) {
      sourceLabel = 'by you';
    }
    return {
      id: habit.id,
      name: habit.name,
      isDone,
      isAutomated: auto !== null,
      source: auto?.source ?? 'manual',
      sourceLabel,
      timing: habit.timing,
    };
  });
}

/**
 * Today's timed habits as dial segments at their real time (clockSpan); untimed habits are in
 * the any-time lane instead.
 */
export function clockHabits(habits: readonly TodayHabit[]): ClockHabit[] {
  return habits.flatMap((habit) => {
    const span = clockSpan(habit.timing);
    if (!span) {
      return [];
    }
    const start = span.start;
    return [
      {
        id: habit.id,
        name: habit.name,
        startMinutes: start,
        endMinutes: span.end,
        source: habit.source,
        doneLabel: habit.sourceLabel || 'done',
        waitingLabel:
          habit.source === 'manual' ? `at ${formatTimeOfDay(start)}` : `waiting for ${SOURCE_NAMES[habit.source]}`,
        isDone: habit.isDone,
      },
    ];
  });
}


/** Distinct tracked habits done per local day — the heatmap counts. */
export function dayCounts(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
): Map<string, number> {
  const tracked = new Set(trackedHabits(habits).map((h) => h.id));
  const counts = new Map<string, number>();
  for (const [day, ids] of doneByDay(entries)) {
    counts.set(day, [...ids].filter((id) => tracked.has(id)).length);
  }
  return counts;
}

/** Every tracked habit that existed that day has an entry (and there was at least one). */
export function isFullyDone(
  day: string,
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
): boolean {
  const { done, total } = dayProgress(day, trackedHabits(habits), doneByDay(entries));
  return total > 0 && done === total;
}

export function streaks(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
  today: string,
): StreakSummary {
  const tracked = trackedHabits(habits);
  if (tracked.length === 0) {
    return { current: 0, best: 0 };
  }
  const done = doneByDay(entries);
  // A day with nothing scheduled (Tuesday for Mon/Wed/Fri habits) neither counts nor breaks a run.
  const stateOf = (day: string): 'done' | 'missed' | 'free' => {
    const p = dayProgress(day, tracked, done);
    if (p.total === 0) {
      return 'free';
    }
    return p.done === p.total ? 'done' : 'missed';
  };
  const firstDay = tracked.map((h) => localDay(new Date(h.createdAtUtc))).sort()[0]!;

  // Current: walk back from today; an unfinished today doesn't break the streak yet.
  let current = 0;
  let cursor = parseISO(today);
  if (stateOf(today) !== 'done') {
    cursor = addDays(cursor, -1);
  }
  for (; localDay(cursor) >= firstDay; cursor = addDays(cursor, -1)) {
    const state = stateOf(localDay(cursor));
    if (state === 'missed') {
      break;
    }
    if (state === 'done') {
      current++;
    }
  }

  // Best: longest run between the first tracked habit and today.
  let best = 0;
  let run = 0;
  for (let day = parseISO(firstDay); localDay(day) <= today; day = addDays(day, 1)) {
    const state = stateOf(localDay(day));
    if (state === 'done') {
      run++;
      best = Math.max(best, run);
    } else if (state === 'missed') {
      run = 0;
    }
  }
  return { current, best: Math.max(best, current) };
}

export function currentWeek(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
  today: string,
): WeekDay[] {
  const tracked = trackedHabits(habits);
  const done = doneByDay(entries);
  const autoDone = doneByDay(entries, (e) => e.source === habitEntrySources.automation);
  const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  return WEEK_LABELS.map((label, i) => {
    const day = localDay(addDays(monday, i));
    const isFuture = day > today;
    const progress = dayProgress(day, tracked, done);
    const auto = dayProgress(day, tracked, autoDone).done;
    return {
      label,
      day,
      done: isFuture ? 0 : progress.done,
      auto: isFuture ? 0 : auto,
      total: progress.total,
      isToday: day === today,
      isFuture,
    };
  });
}

export function milestones(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
): MilestoneView[] {
  return habits
    .filter((h) => !h.isArchived)
    .map((h) => ({ habit: h, progress: milestoneProgress(h, entries) }))
    .filter((m) => m.progress !== null)
    .map(({ habit, progress }) => {
      const { current, target, percent } = progress!;
      return {
        habitId: habit.id,
        name: habit.name,
        current,
        target,
        percent,
        isUnlocked: current >= target,
      };
    })
    .sort((a, b) => Number(a.isUnlocked) - Number(b.isUnlocked))
    .slice(0, 3);
}
