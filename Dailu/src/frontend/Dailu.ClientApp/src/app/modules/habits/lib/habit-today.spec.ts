import { automationSources } from '@habits/enums/automation-source.enum';
import { FrequencyModel } from '@habits/models/frequency.model';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { anyTimeLane, dayPosition, isDueToday, periodProgress } from './habit-today';

/** Local-time ISO string, so tests pass in any timezone. */
const at = (day: string, time = '10:00') => new Date(`${day}T${time}:00`).toISOString();

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'h1',
  name: 'Read',
  type: habitTypes.binary,
  frequency: { type: frequencyTypes.daily, weekDays: [], monthDays: [], timesPerPeriod: 1 },
  timing: { at: null, durationMinutes: null },
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
const weekdays: FrequencyModel = { type: frequencyTypes.weekly, weekDays: [1, 2, 3, 4, 5], monthDays: [], timesPerPeriod: 1 };

describe('habit-today', () => {
  describe('dayPosition', () => {
    it('should map 06:00 → 0, 15:00 → 0.5 and 24:00 → 1, clamped', () => {
      expect(dayPosition(new Date(`${TODAY}T06:00:00`))).toBe(0);
      expect(dayPosition(new Date(`${TODAY}T15:00:00`))).toBe(0.5);
      expect(dayPosition(new Date(`${TODAY}T03:00:00`))).toBe(0);
      expect(dayPosition(new Date(`${TODAY}T23:59:59`))).toBeCloseTo(1, 2);
    });
  });

  describe('isDueToday', () => {
    it('should always expect a daily habit', () => {
      expect(isDueToday(habit(), [], TODAY)).toBeTrue();
    });

    it('should expect a Mon/Wed/Fri habit on those days only', () => {
      const mwf = habit({ frequency: { type: frequencyTypes.weekly, weekDays: [1, 3, 5], monthDays: [], timesPerPeriod: 1 } });
      expect(isDueToday(mwf, [], '2026-11-10')).toBeFalse(); // Tuesday
      expect(isDueToday(mwf, [], '2026-11-11')).toBeTrue(); // Wednesday
    });

    it('should expect a monthly habit only on its picked days, the 31st on 30 November', () => {
      const firstAndFifteenth = habit({ frequency: { type: frequencyTypes.monthly, weekDays: [], monthDays: [1, 15], timesPerPeriod: 1 } });
      const thirtyFirst = habit({ frequency: { type: frequencyTypes.monthly, weekDays: [], monthDays: [31], timesPerPeriod: 1 } });
      expect(isDueToday(firstAndFifteenth, [], '2026-11-15')).toBeTrue();
      expect(isDueToday(firstAndFifteenth, [], '2026-11-16')).toBeFalse();
      expect(isDueToday(thirtyFirst, [], '2026-11-30')).toBeTrue();
      expect(isDueToday(thirtyFirst, [], '2026-11-29')).toBeFalse();
    });

    it('should not expect a habit before it was created', () => {
      expect(isDueToday(habit({ createdAtUtc: new Date(at('2026-11-13')) }), [], TODAY)).toBeFalse();
    });

    it('should not expect a once-a-week habit after an entry earlier this week', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, weekDays: [], monthDays: [], timesPerPeriod: 1 } });
      expect(isDueToday(weekly, [entry('h1', '2026-11-09')], TODAY)).toBeFalse();
    });

    it('should count two entries on the same day as one session', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, weekDays: [], monthDays: [], timesPerPeriod: 2 } });
      expect(isDueToday(weekly, [entry('h1', '2026-11-09'), entry('h1', '2026-11-09', '18:00')], TODAY)).toBeTrue();
    });

    it('should expect a Weekdays habit on Mon–Fri only', () => {
      expect(isDueToday(habit({ frequency: weekdays }), [], TODAY)).toBeTrue();
      expect(isDueToday(habit({ frequency: weekdays }), [], '2026-11-14')).toBeFalse();
    });

    it('should expect a weekly habit until its target is reached this week', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, weekDays: [], monthDays: [], timesPerPeriod: 2 } });
      expect(isDueToday(weekly, [entry('h1', '2026-11-09')], TODAY)).toBeTrue();
      expect(isDueToday(weekly, [entry('h1', '2026-11-09'), entry('h1', '2026-11-10')], TODAY)).toBeFalse();
    });

    it('should keep a weekly habit due on the day its target was reached', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, weekDays: [], monthDays: [], timesPerPeriod: 1 } });
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

    describe('markers', () => {
      const habits = [
        habit({ id: 'read', name: 'Read' }),
        habit({ id: 'write', name: 'Write' }),
        habit({ id: 'walk', name: 'Walk' }),
        habit({ id: 'gym', name: 'Gym' }),
        habit({ id: 'study', name: 'Study' }),
      ];

      it('should put done habits where they were ticked and group the open ones at now', () => {
        const lane = anyTimeLane(habits, [entry('read', TODAY, '08:00'), entry('walk', TODAY, '13:00')], now);
        expect(lane.markers.map((m) => [m.kind, m.items.map((i) => i.id)])).toEqual([
          ['done', ['read']],
          ['done', ['walk']],
          ['open', ['write', 'gym', 'study']],
        ]);
        expect(lane.markers[2]!.position).toBeCloseTo(lane.nowPosition, 5);
        expect(lane.markers[0]!.position).toBeCloseTo((8 - 6) / 18, 5);
      });

      it('should group done habits ticked close together, at their average position', () => {
        const lane = anyTimeLane(habits, [entry('read', TODAY, '10:00'), entry('write', TODAY, '10:30')], now);
        const done = lane.markers.filter((m) => m.kind === 'done');
        expect(done.length).toBe(1);
        expect(done[0]!.items.map((i) => i.id)).toEqual(['read', 'write']);
        expect(done[0]!.position).toBeCloseTo((10.25 - 6) / 18, 5);
      });

      it('should keep done habits apart when they are far enough', () => {
        const lane = anyTimeLane(habits, [entry('read', TODAY, '10:00'), entry('write', TODAY, '11:00')], now);
        expect(lane.markers.filter((m) => m.kind === 'done').length).toBe(2);
      });

      it('should say when and by whom a habit was done', () => {
        const strava = habit({ id: 'run', name: 'Run', automationSource: automationSources.strava });
        const lane = anyTimeLane(
          [habit({ id: 'read', name: 'Read' }), strava],
          [entry('read', TODAY, '08:15'), entry('run', TODAY, '12:00', { source: habitEntrySources.automation })],
          now,
        );
        const items = lane.markers.flatMap((m) => m.items);
        expect(items.map((i) => [i.doneAt, i.doneBy])).toEqual([
          ['08:15', 'by you'],
          ['12:00', 'Strava'],
        ]);
      });

      it('should have no open marker when everything is done', () => {
        const lane = anyTimeLane([habit({ id: 'read' })], [entry('read', TODAY, '08:00')], now);
        expect(lane.markers.map((m) => m.kind)).toEqual(['done']);
      });
    });

    it('should leave out timed habits, which are on the clock', () => {
      const habits = [habit({ id: 'timed', timing: { at: '07:00:00', durationMinutes: 30 } }), habit({ id: 'd' })];
      expect(anyTimeLane(habits, [], now).items.map((i) => i.id)).toEqual(['d']);
    });

    it('should keep habits with only a duration in the lane', () => {
      const habits = [habit({ id: 'read', timing: { at: null, durationMinutes: 30 } })];
      expect(anyTimeLane(habits, [], now).items.map((i) => i.id)).toEqual(['read']);
    });

    it('should leave out habits not due today and archived entries', () => {
      const habits = [habit({ id: 'wd', frequency: weekdays }), habit({ id: 'd' })];
      const lane = anyTimeLane(habits, [entry('d', '2026-11-14', '09:00', { isArchived: true })], new Date('2026-11-14T12:00:00'));
      expect(lane.items.map((i) => i.id)).toEqual(['d']);
      expect(lane.done).toBe(0);
    });
  });

  describe('periodProgress', () => {
    it('should be done or not for a daily habit, however many entries today has', () => {
      expect(periodProgress(habit(), [], TODAY)).toBe(0);
      expect(periodProgress(habit(), [entry('h1', TODAY), entry('h1', TODAY, '18:00')], TODAY)).toBe(1);
    });

    it('should be half done after one session of a 2× a week habit', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, weekDays: [], monthDays: [], timesPerPeriod: 2 } });
      expect(periodProgress(weekly, [entry('h1', '2026-11-09')], TODAY)).toBe(0.5);
      expect(periodProgress(weekly, [entry('h1', '2026-11-09'), entry('h1', '2026-11-09', '18:00')], TODAY)).toBe(0.5);
    });

    it('should count the whole week for a weekly habit', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, weekDays: [], monthDays: [], timesPerPeriod: 4 } });
      expect(periodProgress(weekly, [entry('h1', '2026-11-09'), entry('h1', '2026-11-11'), entry('h1', '2026-11-02')], TODAY)).toBe(0.5);
    });

    it('should count today only for a Weekdays habit', () => {
      expect(periodProgress(habit({ frequency: weekdays }), [entry('h1', '2026-11-11')], TODAY)).toBe(0);
      expect(periodProgress(habit({ frequency: weekdays }), [entry('h1', TODAY)], TODAY)).toBe(1);
    });
  });
});
