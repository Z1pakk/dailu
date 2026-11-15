import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfWeek } from 'date-fns/startOfWeek';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitEntrySources } from '@habit-entries/enums/habit-entry-source.enum';
import { hasFixedDays, hasTime, isScheduledOn, timesPerPeriod } from '@habits/lib/habit-schedule';
import { sourceLabel } from '@habits/lib/habit-progress';
import { localDay } from '@shared/lib/date/local-day';

/*
 * "Any time today": habits without a time of day that are due today; timed habits are on the
 * clock instead. Positions use the same 06:00 → 24:00 scale as the clock timeline.
 */

export interface LaneItem {
  id: string;
  name: string;
  isDone: boolean;
  /** 0..1 on the 06:00 → 24:00 scale: when it was ticked, or "now" while open. */
  position: number;
  /** "10:40" once done. */
  doneAt: string | null;
  /** Who ticked it: "by you", or the integration ("Strava"). */
  doneBy: string | null;
}

/** A marker on the lane's track; hovering it lists its habits. */
export interface LaneMarker {
  kind: 'done' | 'open';
  /** 0..1 on the 06:00 → 24:00 scale. */
  position: number;
  items: LaneItem[];
}

export interface AnyTimeLane {
  items: LaneItem[];
  /** Done habits where they were ticked (close ones grouped), then all open ones at now. */
  markers: LaneMarker[];
  done: number;
  total: number;
  minutesLeft: number;
  nowPosition: number;
}

const DAY_START_H = 6;
const DAY_LENGTH_H = 18;
/** Done markers closer than this share of the track (~45 min) are grouped into one. */
const MARKER_GROUP_GAP = 0.04;

export function dayPosition(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  return Math.min(1, Math.max(0, (hours - DAY_START_H) / DAY_LENGTH_H));
}

function ownEntries(habit: HabitModel, entries: readonly HabitEntryModel[]): HabitEntryModel[] {
  return entries.filter((e) => !e.isArchived && e.habitId === habit.id);
}

/** Entries of the habit in the period (week from Monday, or month) that contains `today`. */
function periodEntries(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): HabitEntryModel[] {
  const day = parseISO(today);
  const start =
    habit.frequency.type === frequencyTypes.monthly ? startOfMonth(day) : startOfWeek(day, { weekStartsOn: 1 });
  const from = localDay(start);
  return ownEntries(habit, entries).filter((e) => {
    const d = localDay(e.completedAtUtc);
    return d >= from && d <= today;
  });
}

function entriesOn(habit: HabitModel, entries: readonly HabitEntryModel[], day: string): HabitEntryModel[] {
  return ownEntries(habit, entries).filter((e) => localDay(e.completedAtUtc) === day);
}

/** Local days with at least one entry; a "N times" habit counts at most one session a day. */
function daysWithEntries(entries: readonly HabitEntryModel[]): Set<string> {
  return new Set(entries.map((e) => localDay(e.completedAtUtc)));
}

export function isDueToday(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): boolean {
  if (!isScheduledOn(habit, today)) {
    return false;
  }
  if (hasFixedDays(habit.frequency)) {
    return true;
  }
  // No days picked: due until done on N days this week/month — and still shown on the day it was finished.
  const before = [...daysWithEntries(periodEntries(habit, entries, today))].filter((d) => d !== today).length;
  return before < timesPerPeriod(habit.frequency);
}

export function periodProgress(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): number {
  if (hasFixedDays(habit.frequency)) {
    return entriesOn(habit, entries, today).length > 0 ? 1 : 0;
  }
  const needed = timesPerPeriod(habit.frequency);
  return Math.min(needed, daysWithEntries(periodEntries(habit, entries, today)).size) / needed;
}

/** Groups done items ticked close together; each group sits at its average position. */
function doneMarkers(done: readonly LaneItem[]): LaneMarker[] {
  const groups: LaneItem[][] = [];
  for (const item of done) {
    const group = groups[groups.length - 1];
    if (group && item.position - group[0]!.position < MARKER_GROUP_GAP) {
      group.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups.map((items) => ({
    kind: 'done',
    position: items.reduce((sum, i) => sum + i.position, 0) / items.length,
    items,
  }));
}

export function anyTimeLane(habits: readonly HabitModel[], entries: readonly HabitEntryModel[], now: Date): AnyTimeLane {
  const today = localDay(now);
  const nowPosition = dayPosition(now);
  const due = habits.filter((h) => !hasTime(h) && isDueToday(h, entries, today));
  const done: (LaneItem & { at: number })[] = [];
  const open: LaneItem[] = [];
  for (const habit of due) {
    const [first] = entriesOn(habit, entries, today).sort((a, b) => a.completedAtUtc.localeCompare(b.completedAtUtc));
    if (first) {
      const at = new Date(first.completedAtUtc);
      done.push({
        id: habit.id,
        name: habit.name,
        isDone: true,
        position: dayPosition(at),
        doneAt: format(at, 'HH:mm'),
        doneBy: first.source === habitEntrySources.automation ? sourceLabel(habit) : 'by you',
        at: at.getTime(),
      });
    } else {
      open.push({ id: habit.id, name: habit.name, isDone: false, position: nowPosition, doneAt: null, doneBy: null });
    }
  }
  done.sort((a, b) => a.at - b.at);
  const doneItems: LaneItem[] = done.map(({ id, name, isDone, position, doneAt, doneBy }) => ({
    id,
    name,
    isDone,
    position,
    doneAt,
    doneBy,
  }));
  const markers = doneMarkers(doneItems);
  if (open.length > 0) {
    markers.push({ kind: 'open', position: nowPosition, items: open });
  }
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return {
    items: [...doneItems, ...open],
    markers,
    done: done.length,
    total: due.length,
    minutesLeft: Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 60_000)),
    nowPosition,
  };
}
