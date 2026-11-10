import { ClockHabit, HabitSource } from '@shared/ui/day-clock/day-clock.model';
import { formatDuration } from '@habits/lib/habit-today';

/*
 * DUMMY DATA. Habits have no time of day in the backend yet, so the clock timeline
 * (Habits page) and the day dial (Dashboard) show this fixed sample day. Only the
 * slot states follow the real clock. Replace with real scheduled habits once times exist.
 */

interface SampleHabit {
  name: string;
  /** Minutes since midnight. */
  start: number;
  minutes: number;
  source: HabitSource;
}

export const SAMPLE_DAY: readonly SampleHabit[] = [
  { name: 'Morning run', start: 6 * 60 + 45, minutes: 45, source: 'strava' },
  { name: 'Take a pill', start: 8 * 60, minutes: 5, source: 'manual' },
  { name: 'Work', start: 9 * 60, minutes: 8 * 60, source: 'manual' },
  { name: 'Embedded lessons', start: 19 * 60, minutes: 2 * 60, source: 'manual' },
  { name: 'Evening walk', start: 21 * 60 + 15, minutes: 30, source: 'google-health' },
  { name: 'Sleep', start: 22 * 60 + 30, minutes: 8 * 60, source: 'google-health' },
];

export type SlotState = 'done' | 'active' | 'later';

export interface SampleSlot {
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

export function sampleTimeline(now: Date): { slots: SampleSlot[]; planned: string } {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const slots = SAMPLE_DAY.map((h) => {
    const visible = Math.min(h.start + h.minutes, 24 * 60) - h.start;
    const left = (h.start - DAY_START) / DAY_LENGTH;
    let state: SlotState = 'later';
    if (nowMin >= h.start + h.minutes) {
      state = 'done';
    } else if (nowMin >= h.start) {
      state = 'active';
    }
    return { name: h.name, left, width: Math.max(0.006, visible / DAY_LENGTH), state };
  });
  const planned = SAMPLE_DAY.reduce((sum, h) => sum + Math.min(h.start + h.minutes, 24 * 60) - h.start, 0);
  return { slots, planned: formatDuration(planned) };
}

/** The same sample day for the dashboard dial. */
export function sampleClockHabits(): ClockHabit[] {
  return SAMPLE_DAY.map((h, i) => ({
    id: `sample-${i}`,
    name: h.name,
    startMinutes: h.start,
    endMinutes: Math.min(h.start + h.minutes, 24 * 60),
    source: h.source,
    doneLabel: '',
    waitingLabel: '',
  }));
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
