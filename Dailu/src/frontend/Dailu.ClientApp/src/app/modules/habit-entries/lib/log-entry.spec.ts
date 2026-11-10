import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { automationSources } from '@habits/enums/automation-source.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { entryDay, entrySummary, habitOptions, LogEntryValue, toEntryRequest } from './log-entry';

const at = (day: string, time = '10:00') => new Date(`${day}T${time}:00`).toISOString();

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'read',
  name: 'Read a book',
  type: habitTypes.measurable,
  frequency: { type: frequencyTypes.daily, timesPerPeriod: 1 },
  target: { value: 1, unit: 'chapter' },
  status: habitStatuses.ongoing,
  isArchived: false,
  tags: [],
  createdAtUtc: new Date(at('2026-11-01')),
  lastCompletedAtUtc: new Date(at('2026-11-01')),
  ...overrides,
});

const entry = (habitId: string, day: string, time = '10:00'): HabitEntryModel => ({
  id: 1, habitId, habitName: habitId, habitType: habitTypes.binary, value: 1, notes: null,
  source: habitEntrySources.manual, externalId: null, completedAtUtc: at(day, time), isArchived: false,
  createdAtUtc: new Date(at(day, time)), updatedAtUtc: new Date(at(day, time)),
});

/** Thursday 2026-11-05. */
const TODAY = '2026-11-05';

const read = habit();
const gym = habit({
  id: 'gym', name: 'Exercises', type: habitTypes.binary,
  automationSource: automationSources.strava, automationFilter: { type: 'strava', activityTypes: [] },
});
const study = habit({ id: 'study', name: 'Study', type: habitTypes.binary, frequency: { type: frequencyTypes.weekly, timesPerPeriod: 3 } });
const pill = habit({ id: 'pill', name: 'Take a pill', type: habitTypes.binary });

describe('log-entry', () => {
  describe('habitOptions', () => {
    it('should list due habits first, then the rest, then the ones done today', () => {
      const entries = [entry('pill', TODAY, '08:00'), entry('study', '2026-11-02'), entry('study', '2026-11-03'), entry('study', '2026-11-04')];
      const options = habitOptions([pill, study, read, gym], entries, TODAY);
      expect(options.map((o) => o.id)).toEqual(['read', 'gym', 'study', 'pill']);
      expect(options.map((o) => o.state)).toEqual(['due', 'due', 'not-due', 'done']);
    });

    it('should hint the source when due, the time when done, the schedule otherwise', () => {
      const entries = [entry('pill', TODAY, '08:00'), entry('study', '2026-11-02'), entry('study', '2026-11-03'), entry('study', '2026-11-04')];
      const hint = (id: string) => habitOptions([pill, study, read, gym], entries, TODAY).find((o) => o.id === id)!.hint;
      expect(hint('read')).toBe('due · by you');
      expect(hint('gym')).toBe('due · Strava');
      expect(hint('pill')).toBe('done · 08:00');
      expect(hint('study')).toBe('3× / week');
    });

    it('should leave out archived habits', () => {
      expect(habitOptions([habit({ isArchived: true })], [], TODAY)).toEqual([]);
    });
  });

  describe('entryDay', () => {
    it('should resolve today, yesterday and a picked date', () => {
      expect(entryDay('today', null, TODAY)).toBe(TODAY);
      expect(entryDay('yesterday', null, TODAY)).toBe('2026-11-04');
      expect(entryDay('pick', new Date('2026-10-30T15:00:00'), TODAY)).toBe('2026-10-30');
      expect(entryDay('pick', null, TODAY)).toBe(TODAY);
    });
  });

  describe('toEntryRequest', () => {
    const value = (o: Partial<LogEntryValue> = {}): LogEntryValue => ({
      habitId: 'read', dayMode: 'today', pickedDate: null, time: new Date(`${TODAY}T16:12:00`), value: 2, notes: '', ...o,
    });

    it('should combine the day and the time into completedAt', () => {
      const request = toEntryRequest(value({ dayMode: 'yesterday' }), read, TODAY);
      expect(request.completedAt).toBe(new Date('2026-11-04T16:12:00').toISOString());
      expect(request).toEqual(jasmine.objectContaining({ habitId: 'read', value: 2, notes: null }));
    });

    it('should log 1 for a binary habit whatever the amount field says', () => {
      expect(toEntryRequest(value({ habitId: 'gym', value: null }), gym, TODAY).value).toBe(1);
    });

    it('should keep a trimmed note', () => {
      expect(toEntryRequest(value({ notes: '  chapter 7  ' }), read, TODAY).notes).toBe('chapter 7');
    });
  });

  describe('entrySummary', () => {
    it('should talk about the streak for a first entry today', () => {
      expect(entrySummary(read, TODAY, TODAY, 58, false)).toBe('This ticks Read a book for today and keeps your 58-day streak going.');
      expect(entrySummary(read, TODAY, TODAY, 0, false)).toBe('This ticks Read a book for today and starts a new streak.');
    });

    it('should say when it adds another entry today', () => {
      expect(entrySummary(read, TODAY, TODAY, 58, true)).toBe('This adds another Read a book entry for today.');
    });

    it('should name the day for an earlier entry', () => {
      expect(entrySummary(read, '2026-11-04', TODAY, 58, false)).toBe('This adds Read a book to Wed 4 Nov.');
    });
  });
});
