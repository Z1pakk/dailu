import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { dayTimeline, formatRingDuration, placeLabels } from './day-timeline';

/** Local-time ISO string, so tests pass in any timezone. */
const at = (day: string, time = '10:00') => new Date(`${day}T${time}:00`).toISOString();

/** Thursday 2026-11-12. */
const TODAY = '2026-11-12';

const habit = (id: string, timing: HabitModel['timing'], overrides: Partial<HabitModel> = {}): HabitModel => ({
  id,
  name: id,
  type: habitTypes.binary,
  frequency: { type: frequencyTypes.daily, weekDays: [], monthDays: [], timesPerPeriod: 1 },
  timing,
  target: { value: 1, unit: 'Session' },
  status: habitStatuses.ongoing,
  isArchived: false,
  tags: [],
  createdAtUtc: new Date(at('2026-01-01')),
  lastCompletedAtUtc: new Date(at('2026-01-01')),
  ...overrides,
});

const entry = (habitId: string, day: string): HabitEntryModel => ({
  id: Math.floor(Math.random() * 1e9),
  habitId,
  habitName: habitId,
  habitType: habitTypes.binary,
  value: 1,
  notes: null,
  source: habitEntrySources.manual,
  externalId: null,
  completedAtUtc: at(day),
  isArchived: false,
  createdAtUtc: new Date(at(day)),
  updatedAtUtc: new Date(at(day)),
});

describe('day-timeline', () => {
  describe('dayTimeline', () => {
    const run = habit('run', { at: '07:00:00', durationMinutes: 45 });
    const work = habit('work', { at: '15:00:00', durationMinutes: 120 });
    const walk = habit('walk', { at: '21:00:00', durationMinutes: 30 });
    const now = new Date(`${TODAY}T16:12:00`);

    it('should place timed habits in time order on the 06:00 → 24:00 scale', () => {
      const { slots } = dayTimeline([walk, run, work], [], now);
      expect(slots.map((s) => s.id)).toEqual(['run', 'work', 'walk']);
      expect(slots[0]!.left).toBeCloseTo(60 / 1080, 5);
      expect(slots[0]!.width).toBeCloseTo(45 / 1080, 5);
    });

    it('should colour slots by real completion, then by the clock', () => {
      const { slots } = dayTimeline([run, work, walk], [entry('walk', TODAY)], now);
      expect(slots.map((s) => s.state)).toEqual(['later', 'active', 'done']);
    });

    it('should leave out untimed habits and habits not scheduled today', () => {
      const untimed = habit('untimed', { at: null, durationMinutes: 30 });
      const monday = habit('monday', { at: '09:00:00', durationMinutes: 30 }, {
        frequency: { type: frequencyTypes.weekly, weekDays: [1], monthDays: [], timesPerPeriod: 1 },
      });
      expect(dayTimeline([untimed, monday, run], [], now).slots.map((s) => s.id)).toEqual(['run']);
    });

    it('should total the planned time and give a time without duration 30 minutes', () => {
      const pill = habit('pill', { at: '08:00:00', durationMinutes: null });
      expect(dayTimeline([run, pill], [], now).planned).toBe('1 h 15 m');
      expect(dayTimeline([], [], now).planned).toBeNull();
    });

    it('should pin an early habit to the start of the track', () => {
      const early = habit('early', { at: '05:00:00', durationMinutes: 120 });
      const [slot] = dayTimeline([early], [], now).slots;
      expect(slot!.left).toBe(0);
      expect(slot!.width).toBeCloseTo(60 / 1080, 5);
    });
  });

  describe('formatRingDuration', () => {
    it('should fit the ring: 45m, 1h30, 2h', () => {
      expect(formatRingDuration(45)).toBe('45m');
      expect(formatRingDuration(90)).toBe('1h30');
      expect(formatRingDuration(120)).toBe('2h');
      expect(formatRingDuration(480)).toBe('8h');
      expect(formatRingDuration(5)).toBe('5m');
    });
  });

  describe('placeLabels', () => {
    // 10 px per character keeps the arithmetic readable.
    const place = (labels: { name: string; left: number }[], trackPx: number) => placeLabels(labels, trackPx, 10, 6);

    it('should keep labels on the first row when they fit', () => {
      const out = place([{ name: 'Run', left: 0 }, { name: 'Work', left: 0.5 }], 400);
      expect(out.map((l) => l.row)).toEqual([0, 0]);
      expect(out[1]!.left).toBe(0.5);
    });

    it('should drop a label to the next row when it would touch the previous one', () => {
      // "Embedded lessons" (160 px) from 280 px reaches 440 px; "Evening walk" starts at 400 px.
      const out = place([{ name: 'Embedded lessons', left: 0.4 }, { name: 'Evening walk', left: 400 / 700 }], 700);
      expect(out.map((l) => l.row)).toEqual([0, 1]);
    });

    it('should go back to the first row once there is room again', () => {
      const out = place(
        [{ name: 'Morning run', left: 0 }, { name: 'Take a pill', left: 0.05 }, { name: 'Work', left: 0.5 }],
        600,
      );
      expect(out.map((l) => l.row)).toEqual([0, 1, 0]);
    });

    it('should pull a label inside the right edge', () => {
      const out = place([{ name: 'Sleep', left: 0.95 }], 400); // 50 px wide from 380 px would end at 430
      expect(out[0]!.left).toBeCloseTo((400 - 50) / 400, 5);
    });

    it('should use the least crowded row when every row is taken', () => {
      const out = place([{ name: 'AAAAAAAAAA', left: 0 }, { name: 'BBBBBBBBBB', left: 0.01 }, { name: 'C', left: 0.02 }], 400);
      expect(out[2]!.row === 0 || out[2]!.row === 1).toBeTrue();
    });
  });
});
