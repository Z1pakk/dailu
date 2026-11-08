import { minutesToClockAngle } from '@shared/ui/charts/arc.geometry';

export type HabitSource = 'github' | 'strava' | 'google-health' | 'manual';
export type ClockHabitState = 'done' | 'next' | 'scheduled';

export interface ClockHabit {
  id: string;
  name: string;
  /** Minutes since midnight. */
  startMinutes: number;
  endMinutes: number;
  source: HabitSource;
  /** Shown once the habit is done, e.g. "auto · Strava 06:52". */
  doneLabel: string;
  /** Shown before it is done, e.g. "at 18:00". */
  waitingLabel: string;
  /**
   * Real completion. When set, state follows it instead of the clock, and the
   * times are only positions on the dial (habits without a time of day).
   */
  isDone?: boolean;
}

export interface ClockHabitView extends ClockHabit {
  state: ClockHabitState;
  startAngle: number;
  endAngle: number;
}

export interface ClockSummary {
  done: number;
  total: number;
  next: ClockHabitView | null;
}

export const SOURCE_NAMES: Record<HabitSource, string> = {
  github: 'GitHub',
  strava: 'Strava',
  'google-health': 'Google Health',
  manual: 'you',
};

/** Short provenance label: "auto · Strava" or "by you". */
export function sourceLabel(source: HabitSource): string {
  return source === 'manual' ? 'by you' : `auto · ${SOURCE_NAMES[source]}`;
}

/**
 * A habit is done once `now >= end` — or, when it carries `isDone`, once it is
 * actually completed. The first habit not done is `next`; the rest are `scheduled`.
 */
export function resolveClockHabits(
  habits: readonly ClockHabit[],
  nowMinutes: number,
): ClockHabitView[] {
  let nextAssigned = false;
  return [...habits]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((habit) => {
      let state: ClockHabitState = 'scheduled';
      const isDone = habit.isDone ?? nowMinutes >= habit.endMinutes;
      if (isDone) {
        state = 'done';
      } else if (!nextAssigned) {
        state = 'next';
        nextAssigned = true;
      }
      return {
        ...habit,
        state,
        startAngle: minutesToClockAngle(habit.startMinutes),
        endAngle: minutesToClockAngle(habit.endMinutes),
      };
    });
}

export function clockSummary(views: readonly ClockHabitView[]): ClockSummary {
  return {
    done: views.filter((v) => v.state === 'done').length,
    total: views.length,
    next: views.find((v) => v.state === 'next') ?? null,
  };
}
