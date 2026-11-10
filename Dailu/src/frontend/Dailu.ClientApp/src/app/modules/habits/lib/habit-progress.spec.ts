import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { automationSources } from '@habits/enums/automation-source.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import {
  filterHabits,
  habitCounts,
  habitStreak,
  milestoneProgress,
  sourceLabel,
  weekDots,
} from './habit-progress';

/** Local-time ISO string, so tests pass in any timezone. */
const at = (day: string, time = '10:00') => new Date(`${day}T${time}:00`).toISOString();

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'h1',
  name: 'Read',
  type: habitTypes.binary,
  frequency: { type: frequencyTypes.daily, timesPerPeriod: 1 },
  target: { value: 1, unit: '' },
  status: habitStatuses.ongoing,
  isArchived: false,
  tags: [],
  createdAtUtc: new Date(at('2026-01-01')),
  lastCompletedAtUtc: new Date(at('2026-01-01')),
  ...overrides,
});

const entry = (day: string, overrides: Partial<HabitEntryModel> = {}): HabitEntryModel => ({
  id: Math.floor(Math.random() * 1e9),
  habitId: 'h1',
  habitName: 'Read',
  habitType: habitTypes.binary,
  value: 1,
  notes: null,
  source: habitEntrySources.manual,
  externalId: null,
  completedAtUtc: at(day),
  isArchived: false,
  createdAtUtc: new Date(at(day)),
  updatedAtUtc: new Date(at(day)),
  ...overrides,
});

/** Wednesday. */
const TODAY = '2026-11-11';

const states = (h: HabitModel, entries: HabitEntryModel[], today = TODAY) =>
  weekDots(h, entries, today).map((dot) => dot.state);

describe('habit-progress', () => {
  describe('weekDots', () => {
    it('should mark done, missed and future days for a daily habit', () => {
      expect(states(habit(), [entry('2026-11-09'), entry('2026-11-11')])).toEqual([
        'done',
        'missed',
        'done',
        'future',
        'future',
        'future',
        'future',
      ]);
    });

    it('should label the days Monday to Sunday', () => {
      const dots = weekDots(habit(), [], TODAY);
      expect(dots.map((d) => d.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
      expect(dots[0]!.day).toBe('2026-11-09');
    });

    it('should leave today open when it is not done yet', () => {
      expect(states(habit(), [])[2]).toBe('open');
    });

    it('should expect weekdays only for a Weekdays habit', () => {
      const weekdays = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 5 } });
      // Sunday: Mon–Fri missed, Saturday open, Sunday (today) open.
      expect(states(weekdays, [], '2026-11-15')).toEqual([
        'missed',
        'missed',
        'missed',
        'missed',
        'missed',
        'open',
        'open',
      ]);
    });

    it('should never mark a custom weekly day as missed', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 3 } });
      expect(states(weekly, [])[1]).toBe('open');
    });

    it('should bucket a late-evening entry into its local day', () => {
      expect(states(habit(), [entry('2026-11-10', { completedAtUtc: at('2026-11-10', '23:30') })])[1]).toBe(
        'done',
      );
    });

    it('should leave days before the habit existed open', () => {
      const created = habit({ createdAtUtc: new Date(at('2026-11-10')) });
      expect(states(created, [])[0]).toBe('open');
      expect(states(created, [])[1]).toBe('missed');
    });

    it('should ignore archived entries', () => {
      expect(states(habit(), [entry('2026-11-09', { isArchived: true })])[0]).toBe('missed');
    });
  });

  describe('habitStreak', () => {
    const days = (...list: string[]) => list.map((d) => entry(d));

    it('should count consecutive days and not break on an unfinished today', () => {
      const entries = days('2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10');
      expect(habitStreak(habit(), entries, TODAY)).toEqual({ count: 4, unit: 'day' });
      expect(habitStreak(habit(), [...entries, entry(TODAY)], TODAY)).toEqual({ count: 5, unit: 'day' });
    });

    it('should skip weekends for a Weekdays habit', () => {
      const weekdays = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 5 } });
      const entries = days('2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10');
      expect(habitStreak(weekdays, entries, TODAY)).toEqual({ count: 4, unit: 'day' });
    });

    it('should not excuse a missed Friday over the weekend', () => {
      const weekdays = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 5 } });
      const entries = days('2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12');
      expect(habitStreak(weekdays, entries, '2026-11-14')).toEqual({ count: 0, unit: 'day' });
      expect(habitStreak(weekdays, entries, '2026-11-16')).toEqual({ count: 0, unit: 'day' });
    });

    it('should keep a Weekdays streak through the weekend when Friday was done', () => {
      const weekdays = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 5 } });
      const entries = days('2026-11-12', '2026-11-13');
      expect(habitStreak(weekdays, entries, '2026-11-15')).toEqual({ count: 2, unit: 'day' });
    });

    it('should count consecutive weeks that reached the target', () => {
      const weekly = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 2 } });
      const entries = days(
        '2026-10-19',
        '2026-10-21',
        '2026-10-26',
        '2026-10-28',
        '2026-11-02',
        '2026-11-04',
        '2026-11-09',
      );
      expect(habitStreak(weekly, entries, TODAY)).toEqual({ count: 3, unit: 'week' });
    });

    it('should break a daily × 3 streak on a day with only 2 entries', () => {
      const thrice = habit({ frequency: { type: frequencyTypes.daily, timesPerPeriod: 3 } });
      const entries = [
        ...days('2026-11-08', '2026-11-08', '2026-11-08'),
        ...days('2026-11-09', '2026-11-09'),
        ...days('2026-11-10', '2026-11-10', '2026-11-10'),
      ];
      expect(habitStreak(thrice, entries, TODAY)).toEqual({ count: 1, unit: 'day' });
    });

    it('should count months for a monthly habit', () => {
      const monthly = habit({ frequency: { type: frequencyTypes.monthly, timesPerPeriod: 1 } });
      expect(habitStreak(monthly, days('2026-09-15', '2026-10-03'), TODAY)).toEqual({ count: 2, unit: 'month' });
    });

    it('should stop at the period the habit was created in', () => {
      const created = habit({ createdAtUtc: new Date(at('2026-11-09')) });
      expect(habitStreak(created, days('2026-11-08', '2026-11-09', '2026-11-10'), TODAY)).toEqual({
        count: 2,
        unit: 'day',
      });
    });
  });

  describe('milestoneProgress', () => {
    it('should count non-archived entries and ignore the stored current', () => {
      const runs = habit({ milestone: { target: 50, current: 0 }, target: { value: 3, unit: 'runs' } });
      const entries = Array.from({ length: 31 }, (_, i) => entry('2026-11-01', { isArchived: i === 0 }));
      expect(milestoneProgress(runs, entries)).toEqual({ current: 30, target: 50, percent: 60, label: '50 runs' });
    });

    it('should fall back to "times" without a unit', () => {
      expect(milestoneProgress(habit({ milestone: { target: 50, current: 0 } }), [])?.label).toBe('50 times');
    });

    it('should cap the percentage at 100', () => {
      const small = habit({ milestone: { target: 1, current: 0 } });
      expect(milestoneProgress(small, [entry('2026-11-01'), entry('2026-11-02')])?.percent).toBe(100);
    });

    it('should return null without a milestone', () => {
      expect(milestoneProgress(habit(), [])).toBeNull();
    });

    it("should only count the habit's own entries", () => {
      const runs = habit({ milestone: { target: 10, current: 0 } });
      expect(milestoneProgress(runs, [entry('2026-11-01', { habitId: 'other' })])?.current).toBe(0);
    });
  });

  describe('habitCounts and filterHabits', () => {
    const habits = [
      habit({ id: 'a', automationSource: automationSources.strava }),
      habit({ id: 'b', automationSource: automationSources.github }),
      habit({ id: 'c', automationSource: automationSources.none }),
      habit({ id: 'd' }),
      habit({ id: 'e', automationSource: automationSources.strava, isArchived: true }),
    ];

    it('should count non-archived habits by source', () => {
      expect(habitCounts(habits)).toEqual({ all: 4, auto: 2, manual: 2 });
    });

    it('should filter by source and keep the order', () => {
      expect(filterHabits(habits, 'manual').map((h) => h.id)).toEqual(['c', 'd']);
      expect(filterHabits(habits, 'auto').map((h) => h.id)).toEqual(['a', 'b']);
      expect(filterHabits(habits, 'all').map((h) => h.id)).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('sourceLabel', () => {
    it('should name the integration or say "by you"', () => {
      expect(sourceLabel(habit({ automationSource: automationSources.strava }))).toBe('Strava');
      expect(sourceLabel(habit({ automationSource: automationSources.googleHealth }))).toBe('Google Health');
      expect(sourceLabel(habit({ automationSource: automationSources.none }))).toBe('by you');
      expect(sourceLabel(habit())).toBe('by you');
    });
  });
});
