import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { partialStreak, streakSummary } from './habit-streaks';

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
  createdAtUtc: new Date(at('2026-11-01')),
  lastCompletedAtUtc: new Date(at('2026-11-01')),
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

const TODAY = '2026-11-12';

describe('habit-streaks', () => {
  describe('partialStreak', () => {
    it('should count consecutive days with at least one entry, not breaking on an unfinished today', () => {
      const entries = ['2026-11-09', '2026-11-10', '2026-11-11'].map((d) => entry('h1', d));
      expect(partialStreak(entries, TODAY)).toEqual({ current: 3, best: 3 });
      expect(partialStreak([...entries, entry('h2', TODAY)], TODAY)).toEqual({ current: 4, best: 4 });
    });

    it('should keep the best run after a gap', () => {
      const entries = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-11'].map((d) => entry('h1', d));
      expect(partialStreak(entries, TODAY)).toEqual({ current: 1, best: 4 });
    });

    it('should ignore archived entries and be 0 without entries', () => {
      expect(partialStreak([entry('h1', '2026-11-11', { isArchived: true })], TODAY)).toEqual({ current: 0, best: 0 });
      expect(partialStreak([], TODAY)).toEqual({ current: 0, best: 0 });
    });

    it('should count a day once however many entries it has', () => {
      const entries = [entry('h1', '2026-11-11'), entry('h2', '2026-11-11'), entry('h3', '2026-11-11')];
      expect(partialStreak(entries, TODAY).current).toBe(1);
    });
  });

  describe('streakSummary', () => {
    it('should report a partial streak longer than the full one', () => {
      const habits = [habit({ id: 'a' }), habit({ id: 'b' })];
      // Mon–Wed: only "a" on Mon, both on Tue and Wed.
      const entries = [
        entry('a', '2026-11-09'),
        entry('a', '2026-11-10'), entry('b', '2026-11-10'),
        entry('a', '2026-11-11'), entry('b', '2026-11-11'),
      ];
      const summary = streakSummary(habits, entries, TODAY);
      expect(summary.partial.current).toBe(3);
      expect(summary.full.current).toBe(2);
    });
  });
});
