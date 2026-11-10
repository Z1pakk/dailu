import { addDays } from 'date-fns/addDays';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { trackedHabits } from '@dashboard/lib/dashboard-day';
import { isAutomated, sourceLabel } from '@habits/lib/habit-progress';
import { localDay } from '@shared/lib/date/local-day';

/*
 * The Entries page feed (Figma "App · Entries"): entries grouped into day cards, newest
 * first, with a "missed" row for every daily habit a past day expected but never got.
 * Days are local calendar days ('yyyy-MM-dd'); archived entries never count.
 */

export type EntrySourceFilter = 'all' | 'auto' | 'manual';

export interface EntryFeedOptions {
  today: string;
  /** Window size in days, ending today; null = all time. */
  days: number | null;
  habitId: string | null;
  source: EntrySourceFilter;
  query: string;
}

export interface FeedRow {
  kind: 'entry' | 'missed';
  key: string;
  entryId: number | null;
  habitId: string;
  habitName: string;
  /** "14:21", or null for a missed habit. */
  time: string | null;
  sourceLabel: string;
  isAuto: boolean;
  detail: string;
  day: string;
}

export interface FeedDay {
  day: string;
  label: string;
  /** Daily habits done / expected that day (from all entries, not just the filtered ones). */
  done: number;
  total: number;
  rows: FeedRow[];
}

export interface EntryFeed {
  days: FeedDay[];
  counts: { total: number; auto: number; manual: number };
  hasEarlier: boolean;
}

function dayLabel(day: string, today: string): string {
  const label = format(parseISO(day), 'EEE d MMM');
  return day === today ? `Today · ${label}` : label;
}

/** "Strava" for an automatic entry of an integrated habit, "by you" for a manual one. */
function tagOf(entry: HabitEntryModel, habit: HabitModel | undefined): string {
  if (entry.source !== habitEntrySources.automation) {
    return 'by you';
  }
  return habit && isAutomated(habit) ? sourceLabel(habit) : 'auto';
}

function detailOf(entry: HabitEntryModel, habit: HabitModel | undefined): string {
  const note = entry.notes?.trim();
  if (note) {
    return note;
  }
  if (habit?.type === habitTypes.measurable) {
    return `${entry.value} ${habit.target.unit}`.trim();
  }
  return '';
}

export function entryFeed(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
  options: EntryFeedOptions,
): EntryFeed {
  const { today, days, habitId, source, query } = options;
  const from = days === null ? null : localDay(addDays(parseISO(today), -(days - 1)));
  const inWindow = (day: string) => day <= today && (from === null || day >= from);
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const needle = query.trim().toLowerCase();
  const live = entries.filter((e) => !e.isArchived);

  // Progress per day uses every entry, so filters don't change "4 of 6 done".
  const doneByDay = new Map<string, Set<string>>();
  for (const e of live) {
    const day = localDay(e.completedAtUtc);
    (doneByDay.get(day) ?? doneByDay.set(day, new Set()).get(day)!).add(e.habitId);
  }

  const matchesText = (...texts: (string | null | undefined)[]) =>
    needle === '' || texts.some((t) => t?.toLowerCase().includes(needle));

  const shown = live.filter((e) => {
    const isAuto = e.source === habitEntrySources.automation;
    return (
      inWindow(localDay(e.completedAtUtc)) &&
      (habitId === null || e.habitId === habitId) &&
      (source === 'all' || isAuto === (source === 'auto')) &&
      matchesText(habitById.get(e.habitId)?.name ?? e.habitName, e.notes)
    );
  });

  const rowsByDay = new Map<string, FeedRow[]>();
  const push = (row: FeedRow) => (rowsByDay.get(row.day) ?? rowsByDay.set(row.day, []).get(row.day)!).push(row);

  for (const e of [...shown].sort((a, b) => b.completedAtUtc.localeCompare(a.completedAtUtc))) {
    const habit = habitById.get(e.habitId);
    const isAuto = e.source === habitEntrySources.automation;
    push({
      kind: 'entry',
      key: `entry-${e.id}`,
      entryId: e.id,
      habitId: e.habitId,
      habitName: habit?.name ?? e.habitName,
      time: format(parseISO(e.completedAtUtc), 'HH:mm'),
      sourceLabel: tagOf(e, habit),
      isAuto,
      detail: detailOf(e, habit),
      day: localDay(e.completedAtUtc),
    });
  }

  // Missed: past days in the window where a tracked daily habit that already existed has no entry.
  const tracked = trackedHabits(habits);
  const createdDay = (h: HabitModel) => localDay(new Date(h.createdAtUtc));
  // Missed rows aren't auto or manual entries, so they only show with the "All" filter.
  if (source === 'all') {
    const start = from ?? tracked.map(createdDay).sort()[0] ?? today;
    for (let d = parseISO(start); localDay(d) < today; d = addDays(d, 1)) {
      const day = localDay(d);
      for (const h of tracked) {
        if (createdDay(h) > day || doneByDay.get(day)?.has(h.id)) {
          continue;
        }
        if ((habitId !== null && h.id !== habitId) || !matchesText(h.name)) {
          continue;
        }
        push({
          kind: 'missed',
          key: `missed-${h.id}-${day}`,
          entryId: null,
          habitId: h.id,
          habitName: h.name,
          time: null,
          sourceLabel: 'missed',
          isAuto: isAutomated(h),
          detail: isAutomated(h) ? 'no matching activity' : 'not logged',
          day,
        });
      }
    }
  }

  const feedDays: FeedDay[] = [...rowsByDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, rows]) => {
      const expected = tracked.filter((h) => createdDay(h) <= day);
      return {
        day,
        label: dayLabel(day, today),
        done: expected.filter((h) => doneByDay.get(day)?.has(h.id)).length,
        total: expected.length,
        rows: [...rows.filter((r) => r.kind === 'entry'), ...rows.filter((r) => r.kind === 'missed')],
      };
    });

  const auto = shown.filter((e) => e.source === habitEntrySources.automation).length;
  const hasEarlier =
    from !== null &&
    (live.some((e) => localDay(e.completedAtUtc) < from) || tracked.some((h) => createdDay(h) < from));

  return { days: feedDays, counts: { total: shown.length, auto, manual: shown.length - auto }, hasEarlier };
}
