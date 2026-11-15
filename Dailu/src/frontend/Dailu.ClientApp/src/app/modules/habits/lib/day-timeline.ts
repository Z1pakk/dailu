import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { clockSpan, isScheduledOn } from '@habits/lib/habit-schedule';
import { formatDuration } from '@shared/lib/date/format-duration';
import { localDay } from '@shared/lib/date/local-day';

/*
 * "Your day on the clock" on the Habits page: today's timed habits as slots on the same
 * 06:00 → 24:00 scale as the any-time lane. Untimed habits are in the lane instead.
 */

/** Done once it has an entry today; otherwise active while "now" is inside its window. */
export type SlotState = 'done' | 'active' | 'later';

export interface TimelineSlot {
  id: string;
  name: string;
  /** 0..1 on the 06:00 → 24:00 scale. */
  left: number;
  width: number;
  state: SlotState;
}

export interface PlacedLabel {
  /** 0..1 share of the track; already pulled inside the right edge. */
  left: number;
  row: number;
}

const DAY_START = 6 * 60;
const DAY_LENGTH = 18 * 60;
const LABEL_ROWS = 2;
/** Keeps a 5-minute habit visible on the track. */
const MIN_WIDTH = 0.006;

export function dayTimeline(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
  now: Date,
): { slots: TimelineSlot[]; planned: string | null } {
  const today = localDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const doneToday = new Set(
    entries.filter((e) => !e.isArchived && localDay(e.completedAtUtc) === today).map((e) => e.habitId),
  );

  let planned = 0;
  const slots = habits
    .filter((h) => isScheduledOn(h, today))
    .flatMap((habit) => {
      const span = clockSpan(habit.timing);
      return span ? [{ habit, span }] : [];
    })
    .sort((a, b) => a.span.start - b.span.start)
    .map(({ habit, span }): TimelineSlot => {
      planned += span.end - span.start;
      // Before 06:00 the slot is pinned to the start of the track.
      const start = Math.max(span.start, DAY_START);
      let state: SlotState = 'later';
      if (doneToday.has(habit.id)) {
        state = 'done';
      } else if (nowMin >= span.start && nowMin < span.end) {
        state = 'active';
      }
      return {
        id: habit.id,
        name: habit.name,
        left: (start - DAY_START) / DAY_LENGTH,
        width: Math.max(MIN_WIDTH, (span.end - start) / DAY_LENGTH),
        state,
      };
    });
  return { slots, planned: planned > 0 ? formatDuration(planned) : null };
}

/**
 * Lays timeline labels out without overlaps: each label (estimated as `charPx` per
 * character) goes on the first row where it clears the previous label on that row by
 * `gapPx`, and is pulled back inside the right edge. When every row is taken it goes on
 * the row whose last label ends first.
 */
export function placeLabels(
  labels: readonly { name: string; left: number }[],
  trackPx: number,
  charPx = 6.2,
  gapPx = 8,
): PlacedLabel[] {
  const rowEnds: number[] = Array.from({ length: LABEL_ROWS }, () => -Infinity);
  return labels.map(({ name, left }) => {
    const width = name.length * charPx;
    const x = Math.max(0, Math.min(left * trackPx, trackPx - width));
    let row = rowEnds.findIndex((end) => x >= end + gapPx);
    if (row < 0) {
      row = rowEnds.indexOf(Math.min(...rowEnds));
    }
    rowEnds[row] = x + width;
    return { left: trackPx > 0 ? x / trackPx : left, row };
  });
}

/** Ring label: "45m", "1h30", "2h". */
export function formatRingDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m}m`;
  }
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
