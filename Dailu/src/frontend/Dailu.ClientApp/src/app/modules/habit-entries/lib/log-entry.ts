import { addDays } from 'date-fns/addDays';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { CreateHabitEntryRequestModel } from '@habit-entries/models/requests/create-habit-entry.request';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { isAutomated, sourceLabel } from '@habits/lib/habit-progress';
import { scheduleLabel } from '@habits/lib/habit-schedule';
import { isDueToday } from '@habits/lib/habit-today';
import { localDay } from '@shared/lib/date/local-day';

/*
 * The Log entry drawer (Figma "Spec · Log entry panel"): which habits to offer, which day
 * the entry lands on, the request it sends and the line under the amount.
 */

export type DayMode = 'today' | 'yesterday' | 'pick';
export type HabitOptionState = 'due' | 'not-due' | 'done';

export interface HabitOption {
  id: string;
  name: string;
  hint: string;
  state: HabitOptionState;
  isAuto: boolean;
}

export interface LogEntryValue {
  habitId: string;
  dayMode: DayMode;
  pickedDate: Date | null;
  time: Date;
  /** Null for done/not-done habits. */
  value: number | null;
  notes: string;
}

const STATE_ORDER: Record<HabitOptionState, number> = { due: 0, 'not-due': 1, done: 2 };

export function habitOptions(
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
  today: string,
): HabitOption[] {
  const firstToday = new Map<string, string>();
  for (const e of [...entries].filter((x) => !x.isArchived).sort((a, b) => a.completedAtUtc.localeCompare(b.completedAtUtc))) {
    if (localDay(e.completedAtUtc) === today && !firstToday.has(e.habitId)) {
      firstToday.set(e.habitId, format(parseISO(e.completedAtUtc), 'HH:mm'));
    }
  }
  return habits
    .filter((h) => !h.isArchived)
    .map((h, index) => {
      let state: HabitOptionState = isDueToday(h, entries, today) ? 'due' : 'not-due';
      let hint = state === 'due' ? `due · ${sourceLabel(h)}` : scheduleLabel(h.frequency);
      const doneAt = firstToday.get(h.id);
      if (doneAt) {
        state = 'done';
        hint = `done · ${doneAt}`;
      }
      return { option: { id: h.id, name: h.name, hint, state, isAuto: isAutomated(h) }, index };
    })
    .sort((a, b) => STATE_ORDER[a.option.state] - STATE_ORDER[b.option.state] || a.index - b.index)
    .map(({ option }) => option);
}

export function entryDay(mode: DayMode, picked: Date | null, today: string): string {
  if (mode === 'yesterday') {
    return localDay(addDays(parseISO(today), -1));
  }
  if (mode === 'pick' && picked) {
    return localDay(picked);
  }
  return today;
}

export function toEntryRequest(value: LogEntryValue, habit: HabitModel, today: string): CreateHabitEntryRequestModel {
  const completedAt = parseISO(entryDay(value.dayMode, value.pickedDate, today));
  completedAt.setHours(value.time.getHours(), value.time.getMinutes(), 0, 0);
  return {
    habitId: value.habitId,
    value: habit.type === habitTypes.measurable ? (value.value ?? 0) : 1,
    notes: value.notes.trim() || null,
    completedAt: completedAt.toISOString(),
  };
}

/** The line under the amount: what logging this entry does. */
export function entrySummary(
  habit: HabitModel,
  day: string,
  today: string,
  streakDays: number,
  alreadyToday: boolean,
): string {
  if (day !== today) {
    return `This adds ${habit.name} to ${format(parseISO(day), 'EEE d MMM')}.`;
  }
  if (alreadyToday) {
    return `This adds another ${habit.name} entry for today.`;
  }
  if (streakDays > 0) {
    return `This ticks ${habit.name} for today and keeps your ${streakDays}-day streak going.`;
  }
  return `This ticks ${habit.name} for today and starts a new streak.`;
}
