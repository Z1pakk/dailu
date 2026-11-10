import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { TagModel } from '@tags/models/tag.model';
import { tagCards, tagLabel, tagsSummary, tagTone, weekProgress } from './tag-cards';

/** Local-time ISO string, so tests pass in any timezone. */
const at = (day: string, time = '10:00') => new Date(`${day}T${time}:00`).toISOString();

const tag = (id: string, name = id, description = ''): TagModel => ({ id, name, description });

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'run',
  name: 'Morning run',
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

/** Wednesday; the week runs Mon 9 – Sun 15 Nov. */
const TODAY = '2026-11-11';

describe('tag-cards', () => {
  describe('weekProgress', () => {
    it('should expect every day of the week for a daily habit and count days done', () => {
      const entries = [entry('run', '2026-11-09'), entry('run', '2026-11-10'), entry('run', '2026-11-10')];
      expect(weekProgress(habit(), entries, TODAY)).toEqual({ done: 2, expected: 7 });
    });

    it('should count up to the daily target per day', () => {
      const h = habit({ frequency: { type: frequencyTypes.daily, timesPerPeriod: 2 } });
      const entries = [entry('run', '2026-11-09'), entry('run', '2026-11-09'), entry('run', '2026-11-09')];
      expect(weekProgress(h, entries, TODAY)).toEqual({ done: 2, expected: 14 });
    });

    it('should expect Monday to Friday for a Weekdays habit and ignore the weekend', () => {
      const h = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 5 } });
      const entries = [entry('run', '2026-11-09'), entry('run', '2026-11-09'), entry('run', '2026-11-08')];
      expect(weekProgress(h, entries, TODAY)).toEqual({ done: 1, expected: 5 });
    });

    it('should cap a weekly habit at its times per week', () => {
      const h = habit({ frequency: { type: frequencyTypes.weekly, timesPerPeriod: 2 } });
      const entries = ['2026-11-09', '2026-11-10', '2026-11-11'].map((d) => entry('run', d));
      expect(weekProgress(h, entries, TODAY)).toEqual({ done: 2, expected: 2 });
    });

    it('should leave monthly habits out of the week', () => {
      const h = habit({ frequency: { type: frequencyTypes.monthly, timesPerPeriod: 4 } });
      expect(weekProgress(h, [entry('run', '2026-11-09')], TODAY)).toEqual({ done: 0, expected: 0 });
    });

    it('should ignore archived entries, other habits and last week', () => {
      const entries = [
        entry('run', '2026-11-09', { isArchived: true }),
        entry('walk', '2026-11-09'),
        entry('run', '2026-11-08'),
      ];
      expect(weekProgress(habit(), entries, TODAY).done).toBe(0);
    });
  });

  describe('tagCards', () => {
    const tags = [tag('fit', 'fitness'), tag('mind', 'mind', 'Head space')];
    const habits = [
      habit({ id: 'run', name: 'Morning run', tags: [tags[0]!] }),
      habit({ id: 'walk', name: 'Evening walk', tags: [tags[0]!] }),
      habit({ id: 'read', name: 'Read a book', tags: [tags[1]!] }),
      habit({ id: 'old', name: 'Old', isArchived: true, tags: [tags[1]!] }),
    ];

    it('should group active habits under their tags and sum the week', () => {
      const entries = [entry('run', '2026-11-09'), entry('run', '2026-11-11'), entry('walk', '2026-11-10')];
      const [fitness, mind] = tagCards(tags, habits, entries, TODAY);
      expect(fitness!.habits.map((h) => h.name)).toEqual(['Morning run', 'Evening walk']);
      expect(fitness!).toEqual(jasmine.objectContaining({ done: 3, expected: 14, percent: 21 }));
      expect(mind!.habits.map((h) => h.name)).toEqual(['Read a book']);
    });

    it('should mark habits done today', () => {
      const [fitness] = tagCards(tags, habits, [entry('run', TODAY), entry('walk', '2026-11-10')], TODAY);
      expect(fitness!.habits.map((h) => h.isDoneToday)).toEqual([true, false]);
    });

    it('should have no percent when nothing is expected this week', () => {
      const [empty] = tagCards([tag('empty')], habits, [], TODAY);
      expect(empty!.percent).toBeNull();
      expect(empty!.habits).toEqual([]);
    });

    it('should filter by tag name, description or habit name', () => {
      expect(tagCards(tags, habits, [], TODAY, 'FIT').map((c) => c.id)).toEqual(['fit']);
      expect(tagCards(tags, habits, [], TODAY, 'head').map((c) => c.id)).toEqual(['mind']);
      expect(tagCards(tags, habits, [], TODAY, 'walk').map((c) => c.id)).toEqual(['fit']);
    });
  });

  it('should give a tag the same tone every time', () => {
    expect(tagTone('abc')).toBe(tagTone('abc'));
    expect(['primary', 'ink', 'coral', 'gray']).toContain(tagTone('abc'));
  });

  it('should prefix the name with one #', () => {
    expect(tagLabel('fitness')).toBe('#fitness');
    expect(tagLabel(' #focus ')).toBe('#focus');
  });

  it('should count tags and distinct tagged habits', () => {
    const shared = { id: 'run', name: 'Run', isDoneToday: false };
    const card = { id: 'a', name: 'a', description: '', tone: 'ink' as const, done: 0, expected: 0, percent: null };
    expect(tagsSummary([{ ...card, habits: [shared] }, { ...card, id: 'b', habits: [shared, { ...shared, id: 'x' }] }])).toEqual({
      tags: 2,
      habits: 2,
    });
  });
});
