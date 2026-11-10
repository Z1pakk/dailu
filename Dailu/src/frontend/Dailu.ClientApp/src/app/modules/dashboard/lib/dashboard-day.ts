import { addDays } from 'date-fns/addDays';
import { parseISO } from 'date-fns/parseISO';
import { startOfWeek } from 'date-fns/startOfWeek';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { ClockHabit, HabitSource, SOURCE_NAMES } from '@shared/ui/day-clock/day-clock.model';
import { localDay } from '@shared/lib/date/local-day';
import { milestoneProgress } from '@habits/lib/habit-progress';

/*
 * Dashboard day maths. Only daily habits are "tracked": weekly / monthly habits
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

/** The dial runs 06:00 → 24:00; untimed habits are spread evenly over it. */
const DIAL_START = 6 * 60;
const DIAL_LENGTH = 18 * 60;
/** Share of each habit's slot its segment fills; the rest is the gap. */
const SEGMENT_FILL = 0.7;

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
      h.frequency.type === frequencyTypes.daily,
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

function existedOn(habit: HabitModel, day: string): boolean {
  return localDay(new Date(habit.createdAtUtc)) <= day;
}

function dayProgress(
  day: string,
  habits: readonly HabitModel[],
  done: ReadonlyMap<string, Set<string>>,
): { done: number; total: number } {
  const ids = done.get(day);
  const existing = habits.filter((h) => existedOn(h, day));
  return {
    done: existing.filter((h) => ids?.has(h.id)).length,
    total: existing.length,
  };
}

export function todayHabits(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
  today: string,
): TodayHabit[] {
  const doneToday = doneByDay(entries).get(today);
  return trackedHabits(habits).map((habit) => {
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
    };
  });
}

/**
 * Today's habits as dial segments. Habits have no time of day yet, so they are
 * spread evenly from 06:00 to midnight and coloured by real completion.
 */
export function clockHabits(habits: readonly TodayHabit[]): ClockHabit[] {
  const slot = DIAL_LENGTH / Math.max(1, habits.length);
  return habits.map((habit, i) => {
    const start = Math.round(DIAL_START + i * slot);
    return {
      id: habit.id,
      name: habit.name,
      startMinutes: start,
      endMinutes: Math.round(start + slot * SEGMENT_FILL),
      source: habit.source,
      doneLabel: habit.sourceLabel || 'done',
      waitingLabel: habit.source === 'manual' ? 'not done yet' : `waiting for ${SOURCE_NAMES[habit.source]}`,
      isDone: habit.isDone,
    };
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
  const isDone = (day: string) => {
    const p = dayProgress(day, tracked, done);
    return p.total > 0 && p.done === p.total;
  };

  // Current: walk back from today; an unfinished today doesn't break the streak yet.
  let current = 0;
  let cursor = parseISO(today);
  if (!isDone(today)) {
    cursor = addDays(cursor, -1);
  }
  while (isDone(localDay(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // Best: longest run between the first tracked habit and today.
  const firstDay = tracked.map((h) => localDay(new Date(h.createdAtUtc))).sort()[0]!;
  let best = 0;
  let run = 0;
  for (let day = parseISO(firstDay); localDay(day) <= today; day = addDays(day, 1)) {
    if (isDone(localDay(day))) {
      run++;
      best = Math.max(best, run);
    } else {
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
