import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { anyTimeLane, dayPosition, formatDuration, isDueToday, periodProgress } from './habit-today';

/** Local-time ISO string, so tests pass in any timezone. */
const at = (day: string, time = '10:00') => new Date(`${day}T${time}:00`).toISOString();

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'h1',
  name: 'Read',
  type: habitTypes.binary,
  frequency: { type: frequencyTypes.daily, timesPerPeriod: 1 },
  target: { value: 1, unit: 'Session' },
  status: habitStatuses.ongoing,
  isArchived: false,
  tags: [],
  createdAtUtc: new Date(at('2026-01-01')),
  lastCompletedAtUtc: new Date(at('2026-01-01')),
  ...overrides,
});

const entry = (habitId: string, day: string, time = '10:00', overrides: Partial<HabitEntryModel> = {}): HabitEntryModel => ({
  id: Math.floor(Math.random() * 1e9),
  habitId,
  habitName: habitId,
  habitType: habitTypes.binary,
  value: 1,
  notes: null,
  source: habitEntrySources.manual,
  externalId: null,
  completedAtUtc: at(day, time),
  isArchived: false,
  createdAtUtc: new Date(at(day, time)),
  updatedAtUtc: new Date(at(day, time)),
  ...overrides,
});

/** Thursday 2026-11-12. */
const TODAY = '2026-11-12';
const weekdays = { type: frequencyTypes.weekly, timesPerPeriod: 5 } as const;

describe('habit-today', () => {
  describe('dayPosition', () => {
    it('should map 06:00 → 0, 15:00 → 0.5 and 24:00 → 1, clamped', () => {
      expect(dayPosition(new Date(`${TODAY}T06:00:00`))).toBe(0);
      expect(dayPosition(new Date(`${TODAY}T15:00:00`))).toBe(0.5);
      expect(dayPosition(new Date(`${TODAY}T03:00:00`))).toBe(0);
      expect(dayPosition(new Date(`${TODAY}T23:59:59`))).toBeCloseTo(1, 2);
    });
  });

  describe('formatDuration', () => {
    it('should format hours and minutes the way the lane shows them', () => {
      expect(formatDuration(468)).toBe('7 h 48 m');
      expect(formatDuration(45)).toBe('45 m');
      expect(formatDuration(120)).toBe('2 h');
      expect(formatDuration(0)).toBe('0 m');
    });
  });

  describe('isDueToday', () => {
    it('should always expect a daily habit', () => {
      expect(isDueToday(habit(), [], TODAY)).toBeTrue();
    });

    it('should expect a Weekdays habit on Mon–Fri only', () => {
      expect(isDueToday(habit({ frequency: weekdays }), [], TODAY)).toBeTrue();
      expect(isDueToday(habit({ frequency: weekdays }), [], '2026-11-14')).toBeFalse();
    });

    it('should expect a weekly habit until its target is reached this week', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 2 } });
      expect(isDueToday(weekly, [entry('h1', '2026-11-09')], TODAY)).toBeTrue();
      expect(isDueToday(weekly, [entry('h1', '2026-11-09'), entry('h1', '2026-11-10')], TODAY)).toBeFalse();
    });

    it('should keep a weekly habit due on the day its target was reached', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 1 } });
      expect(isDueToday(weekly, [entry('h1', TODAY)], TODAY)).toBeTrue();
    });

    it('should not expect archived habits', () => {
      expect(isDueToday(habit({ isArchived: true }), [], TODAY)).toBeFalse();
    });
  });

  describe('anyTimeLane', () => {
    const now = new Date(`${TODAY}T16:12:00`);

    it('should list due habits with done ones at their tick time and open ones at now', () => {
      const habits = [habit({ id: 'read', name: 'Read a book' }), habit({ id: 'gym', name: 'Exercises' })];
      const lane = anyTimeLane(habits, [entry('read', TODAY, '10:40')], now);
      expect(lane.total).toBe(2);
      expect(lane.done).toBe(1);
      expect(lane.minutesLeft).toBe(468);
      expect(lane.nowPosition).toBeCloseTo((16.2 - 6) / 18, 5);
      const read = lane.items.find((i) => i.id === 'read')!;
      expect(read.isDone).toBeTrue();
      expect(read.position).toBeCloseTo((10 + 40 / 60 - 6) / 18, 5);
      const gym = lane.items.find((i) => i.id === 'gym')!;
      expect(gym.isDone).toBeFalse();
      expect(gym.position).toBeCloseTo(lane.nowPosition, 5);
    });

    it('should put done habits first, in the order they were ticked', () => {
      const habits = [habit({ id: 'a' }), habit({ id: 'b' }), habit({ id: 'c' })];
      const lane = anyTimeLane(habits, [entry('c', TODAY, '08:00'), entry('a', TODAY, '12:00')], now);
      expect(lane.items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    });

    it('should leave out habits not due today and archived entries', () => {
      const habits = [habit({ id: 'wd', frequency: weekdays }), habit({ id: 'd' })];
      const lane = anyTimeLane(habits, [entry('d', '2026-11-14', '09:00', { isArchived: true })], new Date('2026-11-14T12:00:00'));
      expect(lane.items.map((i) => i.id)).toEqual(['d']);
      expect(lane.done).toBe(0);
    });
  });

  describe('periodProgress', () => {
    it('should be today’s share for a daily habit', () => {
      const twice = habit({ frequency: { type: frequencyTypes.daily, timesPerPeriod: 2 } });
      expect(periodProgress(twice, [entry('h1', TODAY)], TODAY)).toBe(0.5);
      expect(periodProgress(twice, [entry('h1', TODAY), entry('h1', TODAY), entry('h1', TODAY)], TODAY)).toBe(1);
    });

    it('should count the whole week for a weekly habit', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 4 } });
      expect(periodProgress(weekly, [entry('h1', '2026-11-09'), entry('h1', '2026-11-11'), entry('h1', '2026-11-02')], TODAY)).toBe(0.5);
    });

    it('should count today only for a Weekdays habit', () => {
      expect(periodProgress(habit({ frequency: weekdays }), [entry('h1', '2026-11-11')], TODAY)).toBe(0);
      expect(periodProgress(habit({ frequency: weekdays }), [entry('h1', TODAY)], TODAY)).toBe(1);
    });
  });
});
