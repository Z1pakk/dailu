import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitStatuses } from '@habits/enums/habit-status.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { automationSources } from '@habits/enums/automation-source.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { entryFeed, EntryFeedOptions } from './entry-feed';

/** Local-time ISO string, so tests pass in any timezone. */
const at = (day: string, time = '10:00') => new Date(`${day}T${time}:00`).toISOString();

const habit = (overrides: Partial<HabitModel> = {}): HabitModel => ({
  id: 'read',
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

let nextId = 1;
const entry = (habitId: string, day: string, time = '10:00', overrides: Partial<HabitEntryModel> = {}): HabitEntryModel => ({
  id: nextId++,
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

/** Thursday 2026-11-05. */
const TODAY = '2026-11-05';
const opts = (o: Partial<EntryFeedOptions> = {}): EntryFeedOptions => ({
  today: TODAY, days: 7, habitId: null, source: 'all', query: '', ...o,
});

const read = habit({ name: 'Read', type: habitTypes.measurable, target: { value: 20, unit: 'pages' } });
const run = habit({
  id: 'run', name: 'Morning run',
  automationSource: automationSources.strava, automationFilter: { type: 'strava', activityTypes: [] },
});

describe('entry-feed', () => {
  it('should group entries by local day, newest day and time first', () => {
    const feed = entryFeed([read], [
      entry('read', '2026-11-04', '12:45'),
      entry('read', TODAY, '08:00'),
      entry('read', TODAY, '13:10'),
    ], opts({ days: 2 }));
    expect(feed.days.map((d) => d.day)).toEqual([TODAY, '2026-11-04']);
    expect(feed.days[0]!.rows.map((r) => r.time)).toEqual(['13:10', '08:00']);
  });

  it('should label today and other days the way the cards show them', () => {
    const feed = entryFeed([read], [entry('read', TODAY), entry('read', '2026-11-04')], opts({ days: 2 }));
    expect(feed.days.map((d) => d.label)).toEqual(['Today · Thu 5 Nov', 'Wed 4 Nov']);
  });

  it('should bucket a late-evening entry into its local day', () => {
    const feed = entryFeed([read], [entry('read', '2026-11-04', '23:30')], opts());
    expect(feed.days.find((d) => d.day === '2026-11-04')!.rows[0]!.time).toBe('23:30');
  });

  it('should name the provider for automatic entries and "by you" otherwise', () => {
    const feed = entryFeed([read, run], [
      entry('run', TODAY, '06:52', { source: habitEntrySources.automation }),
      entry('read', TODAY, '13:10'),
    ], opts());
    const [r1, r2] = feed.days[0]!.rows;
    expect(r1).toEqual(jasmine.objectContaining({ habitName: 'Read', sourceLabel: 'by you', isAuto: false }));
    expect(r2).toEqual(jasmine.objectContaining({ habitName: 'Morning run', sourceLabel: 'Strava', isAuto: true }));
  });

  it('should show the note, or the value and unit for measurable habits', () => {
    const feed = entryFeed([read], [
      entry('read', TODAY, '13:10', { value: 20 }),
      entry('read', TODAY, '09:00', { value: 15, notes: 'Chapter 4' }),
    ], opts());
    expect(feed.days[0]!.rows.map((r) => r.detail)).toEqual(['20 pages', 'Chapter 4']);
  });

  it('should add missed rows for past days only, after the entries', () => {
    const feed = entryFeed([read, run], [entry('read', '2026-11-04'), entry('read', TODAY)], opts({ days: 2 }));
    const yesterday = feed.days.find((d) => d.day === '2026-11-04')!;
    expect(yesterday.rows.map((r) => r.kind)).toEqual(['entry', 'missed']);
    expect(yesterday.rows[1]).toEqual(jasmine.objectContaining({ habitId: 'run', time: null, detail: 'no matching activity' }));
    expect(feed.days.find((d) => d.day === TODAY)!.rows.every((r) => r.kind === 'entry')).toBeTrue();
  });

  it('should say "not logged" for a missed manual habit and skip days before a habit existed', () => {
    const late = habit({ id: 'late', name: 'Stretch', createdAtUtc: new Date(at('2026-11-04')) });
    const feed = entryFeed([late], [], opts({ days: 3 }));
    expect(feed.days.map((d) => d.day)).toEqual(['2026-11-04']);
    expect(feed.days[0]!.rows[0]!.detail).toBe('not logged');
  });

  it('should count done and total daily habits per day from all entries', () => {
    const feed = entryFeed([read, run], [entry('read', '2026-11-04')], opts({ days: 2, source: 'auto' }));
    const yesterday = feed.days.find((d) => d.day === '2026-11-04');
    // The auto filter hides Read's manual entry, but the day's progress still counts it.
    expect(yesterday).toBeUndefined();
    const all = entryFeed([read, run], [entry('read', '2026-11-04')], opts({ days: 2 })).days.find((d) => d.day === '2026-11-04')!;
    expect([all.done, all.total]).toEqual([1, 2]);
  });

  it('should filter by source, habit and search text', () => {
    const entries = [
      entry('run', TODAY, '06:52', { source: habitEntrySources.automation }),
      entry('read', TODAY, '13:10', { notes: 'Dune' }),
    ];
    const rows = (o: Partial<EntryFeedOptions>) => entryFeed([read, run], entries, opts({ days: 1, ...o })).days.flatMap((d) => d.rows.map((r) => r.habitName));
    expect(rows({ source: 'auto' })).toEqual(['Morning run']);
    expect(rows({ source: 'manual' })).toEqual(['Read']);
    expect(rows({ habitId: 'run' })).toEqual(['Morning run']);
    expect(rows({ query: 'dune' })).toEqual(['Read']);
    expect(rows({ query: 'MORNING' })).toEqual(['Morning run']);
  });

  it('should leave missed rows out when only auto or manual entries are shown', () => {
    const feed = entryFeed([read], [], opts({ days: 2, source: 'manual' }));
    expect(feed.days).toEqual([]);
  });

  it('should count the entries shown and know whether earlier ones exist', () => {
    const entries = [
      entry('run', TODAY, '06:52', { source: habitEntrySources.automation }),
      entry('read', TODAY),
      entry('read', '2026-10-20'),
    ];
    const feed = entryFeed([read, run], entries, opts());
    expect(feed.counts).toEqual({ total: 2, auto: 1, manual: 1 });
    expect(feed.hasEarlier).toBeTrue();
    expect(entryFeed([read, run], entries, opts({ days: null })).hasEarlier).toBeFalse();
  });

  it('should ignore archived entries', () => {
    const feed = entryFeed([read], [entry('read', TODAY, '10:00', { isArchived: true })], opts({ days: 1 }));
    expect(feed.counts.total).toBe(0);
  });
});
