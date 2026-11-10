import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { automationSources } from '@habits/enums/automation-source.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import {
  clockHabits,
  currentWeek,
  greeting,
  localDay,
  milestones,
  streaks,
  todayHabits,
  trackedHabits,
} from './dashboard-day';

/** Local-time ISO string, so tests pass in any timezone. */
const at = (day: string, time = '10:00') => new Date(`${day}T${time}:00`).toISOString();

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'h1',
  name: 'Read',
  type: habitTypes.binary,
  frequency: { type: frequencyTypes.daily, timesPerPeriod: 1 },
  target: { value: 1, unit: '' } as HabitModel['target'],
  status: habitStatuses.ongoing,
  isArchived: false,
  tags: [],
  createdAtUtc: new Date(at('2026-01-01')),
  lastCompletedAtUtc: new Date(at('2026-01-01')),
  ...overrides,
});

const entry = (habitId: string, day: string, overrides: Partial<HabitEntryModel> = {}): HabitEntryModel => ({
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
  ...overrides,
});

describe('dashboard-day', () => {
  describe('localDay', () => {
    it('should bucket a late-evening entry into its local day', () => {
      expect(localDay(at('2026-11-05', '23:30'))).toBe('2026-11-05');
    });
  });

  describe('greeting', () => {
    const g = (time: string) => greeting(new Date(`2026-11-05T${time}:00`));

    it('should switch at 05:00, 12:00 and 18:00', () => {
      expect(g('04:59')).toBe('Good evening');
      expect(g('05:00')).toBe('Good morning');
      expect(g('11:59')).toBe('Good morning');
      expect(g('12:00')).toBe('Good afternoon');
      expect(g('17:59')).toBe('Good afternoon');
      expect(g('18:00')).toBe('Good evening');
    });
  });

  describe('trackedHabits', () => {
    it('should keep only daily, ongoing, non-archived habits', () => {
      const habits = [
        habit({ id: 'daily' }),
        habit({ id: 'weekly', frequency: { type: frequencyTypes.weekly, timesPerPeriod: 1 } }),
        habit({ id: 'archived', isArchived: true }),
        habit({ id: 'completed', status: habitStatuses.completed }),
      ];
      expect(trackedHabits(habits).map((h) => h.id)).toEqual(['daily']);
    });
  });

  describe('todayHabits', () => {
    const today = '2026-11-05';

    it('should mark habits done when they have an entry today', () => {
      const habits = [habit({ id: 'a', name: 'A' }), habit({ id: 'b', name: 'B' })];
      const entries = [entry('a', today), entry('b', '2026-11-04')];
      const result = todayHabits(habits, entries, today);
      expect(result.map((h) => [h.id, h.isDone])).toEqual([['a', true], ['b', false]]);
    });

    it('should ignore archived entries', () => {
      const result = todayHabits([habit({ id: 'a' })], [entry('a', today, { isArchived: true })], today);
      expect(result[0]!.isDone).toBeFalse();
    });

    it('should label the source of each habit', () => {
      const habits = [
        habit({ id: 'gh', automationSource: automationSources.github }),
        habit({ id: 'st', automationSource: automationSources.strava }),
        habit({ id: 'gf', automationSource: automationSources.googleHealth }),
        habit({ id: 'done' }),
        habit({ id: 'todo' }),
      ];
      const result = todayHabits(habits, [entry('done', today)], today);
      expect(result.map((h) => h.sourceLabel)).toEqual([
        'GitHub',
        'Strava',
        'Google Health',
        'by you',
        '',
      ]);
      expect(result.map((h) => h.isAutomated)).toEqual([true, true, true, false, false]);
      expect(result.map((h) => h.source)).toEqual(['github', 'strava', 'google-health', 'manual', 'manual']);
    });
  });

  describe('streaks', () => {
    const habits = [habit({ id: 'a' }), habit({ id: 'b' })];
    const both = (day: string) => [entry('a', day), entry('b', day)];

    it('should count consecutive fully done days ending today', () => {
      const entries = [...both('2026-11-03'), ...both('2026-11-04'), ...both('2026-11-05')];
      expect(streaks(habits, entries, '2026-11-05').current).toBe(3);
    });

    it('should not break the streak while today is still open', () => {
      const entries = [...both('2026-11-03'), ...both('2026-11-04'), entry('a', '2026-11-05')];
      expect(streaks(habits, entries, '2026-11-05').current).toBe(2);
    });

    it('should reset after a gap and remember the best run', () => {
      const entries = [
        ...both('2026-10-01'),
        ...both('2026-10-02'),
        ...both('2026-10-03'),
        ...both('2026-11-04'),
        ...both('2026-11-05'),
      ];
      expect(streaks(habits, entries, '2026-11-05')).toEqual({ current: 2, best: 3 });
    });

    it('should not hold earlier days against a habit created today', () => {
      const withNew = [...habits, habit({ id: 'new', createdAtUtc: new Date(at('2026-11-05')) })];
      const entries = [...both('2026-11-04'), ...both('2026-11-05'), entry('new', '2026-11-05')];
      expect(streaks(withNew, entries, '2026-11-05').current).toBe(2);
    });

    it('should be zero without habits', () => {
      expect(streaks([], [], '2026-11-05')).toEqual({ current: 0, best: 0 });
    });
  });

  describe('currentWeek', () => {
    it('should list Monday to Sunday with today and future days flagged', () => {
      const week = currentWeek([habit({ id: 'a' })], [entry('a', '2026-11-03')], '2026-11-05');
      expect(week.map((d) => d.day)).toEqual([
        '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
      ]);
      expect(week.map((d) => d.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
      expect(week[1]).toEqual(jasmine.objectContaining({ done: 1, total: 1, isToday: false, isFuture: false }));
      expect(week[3]!.isToday).toBeTrue();
      expect(week[4]).toEqual(jasmine.objectContaining({ done: 0, isFuture: true }));
    });

    it('should count how many of the done habits were checked automatically', () => {
      const habits = [habit({ id: 'a' }), habit({ id: 'b' })];
      const entries = [
        entry('a', '2026-11-04', { source: habitEntrySources.automation }),
        entry('b', '2026-11-04'),
      ];
      expect(currentWeek(habits, entries, '2026-11-05')[2]).toEqual(
        jasmine.objectContaining({ done: 2, auto: 1 }),
      );
    });
  });

  describe('milestones', () => {
    it('should round progress, flag unlocked ones and cap at three', () => {
      const habits = [
        habit({ id: 'u', name: 'Unlocked', milestone: { target: 2, current: 0 } }),
        habit({ id: 'a', name: 'A', milestone: { target: 3, current: 0 } }),
        habit({ id: 'b', name: 'B', milestone: { target: 100, current: 0 } }),
        habit({ id: 'c', name: 'C', milestone: { target: 30, current: 0 } }),
        habit({ id: 'none' }),
      ];
      const entries = [entry('u', '2026-11-01'), entry('u', '2026-11-02'), entry('a', '2026-11-01')];
      const result = milestones(habits, entries);
      expect(result.length).toBe(3);
      expect(result.map((m) => m.habitId)).toEqual(['a', 'b', 'c']);
      expect(result[0]!.percent).toBe(33);
      expect(milestones([habits[0]!], entries)[0]).toEqual(
        jasmine.objectContaining({ current: 2, percent: 100, isUnlocked: true }),
      );
    });

    it('should count entries instead of the stored current', () => {
      const result = milestones([habit({ milestone: { target: 10, current: 7 } })], []);
      expect(result[0]).toEqual(jasmine.objectContaining({ current: 0, percent: 0 }));
    });
  });

  describe('clockHabits', () => {
    const today = (id: string, isDone: boolean, source: 'manual' | 'github' = 'manual') => ({
      id,
      name: id,
      isDone,
      isAutomated: source !== 'manual',
      source,
      sourceLabel: isDone ? 'by you' : '',
    });

    it('should spread habits evenly from 06:00 to midnight', () => {
      const result = clockHabits([today('a', true), today('b', false), today('c', false)]);
      expect(result.map((h) => h.startMinutes)).toEqual([360, 720, 1080]);
      expect(result.map((h) => h.endMinutes)).toEqual([612, 972, 1332]);
    });

    it('should carry completion and label the source', () => {
      const [done, open, auto] = clockHabits([today('a', true), today('b', false), today('c', false, 'github')]);
      expect(done).toEqual(jasmine.objectContaining({ isDone: true, doneLabel: 'by you' }));
      expect(open).toEqual(jasmine.objectContaining({ isDone: false, waitingLabel: 'not done yet' }));
      expect(auto).toEqual(jasmine.objectContaining({ source: 'github', waitingLabel: 'waiting for GitHub' }));
    });

    it('should be empty without habits', () => {
      expect(clockHabits([])).toEqual([]);
    });
  });
});
