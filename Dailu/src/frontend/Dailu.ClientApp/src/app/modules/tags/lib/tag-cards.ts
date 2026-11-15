import { addDays } from 'date-fns/addDays';
import { parseISO } from 'date-fns/parseISO';
import { startOfWeek } from 'date-fns/startOfWeek';
import { HabitModel } from '@habits/models/habit.model';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { hasFixedDays, matchesDay, timesPerPeriod } from '@habits/lib/habit-schedule';
import { TagModel } from '@tags/models/tag.model';
import { localDay } from '@shared/lib/date/local-day';

/*
 * Tag cards for the Tags page: each tag's active habits and how this week (Monday to Sunday)
 * is going for them. Monthly habits are listed but don't count toward the week.
 */

/** Tags have no stored colour, so each gets one of the dial colours from its id. */
export type TagTone = 'primary' | 'ink' | 'coral' | 'gray';

export interface TagCardHabit {
  id: string;
  name: string;
  isDoneToday: boolean;
}

export interface TagCard {
  id: string;
  name: string;
  description: string;
  tone: TagTone;
  habits: TagCardHabit[];
  done: number;
  expected: number;
  /** null when nothing is expected this week. */
  percent: number | null;
}

export interface WeekProgress {
  done: number;
  expected: number;
}

const TONES: readonly TagTone[] = ['primary', 'ink', 'coral', 'gray'];

export function tagTone(id: string): TagTone {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return TONES[hash % TONES.length]!;
}

export function tagLabel(name: string): string {
  return `#${name.trim().replace(/^#+/, '')}`;
}

/** Entries of the habit per local day of this week, up to today. */
function weekPerDay(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): Map<string, number> {
  const from = localDay(startOfWeek(parseISO(today), { weekStartsOn: 1 }));
  const perDay = new Map<string, number>();
  for (const entry of entries) {
    if (entry.isArchived || entry.habitId !== habit.id) {
      continue;
    }
    const day = localDay(entry.completedAtUtc);
    if (day >= from && day <= today) {
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
  }
  return perDay;
}

export function weekProgress(habit: HabitModel, entries: readonly HabitEntryModel[], today: string): WeekProgress {
  const frequency = habit.frequency;
  const perDay = weekPerDay(habit, entries, today);
  if (hasFixedDays(frequency)) {
    // Every day of this week the habit is scheduled on; done = those with an entry so far.
    const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
    const scheduled = Array.from({ length: 7 }, (_, i) => localDay(addDays(monday, i))).filter((day) =>
      matchesDay(frequency, day),
    );
    return { done: scheduled.filter((day) => perDay.has(day)).length, expected: scheduled.length };
  }
  if (frequency.type === frequencyTypes.weekly) {
    const times = timesPerPeriod(frequency);
    return { done: Math.min(perDay.size, times), expected: times };
  }
  return { done: 0, expected: 0 };
}

function matches(card: TagCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return [card.name, card.description, ...card.habits.map((h) => h.name)].some((text) => text.toLowerCase().includes(q));
}

export function tagCards(
  tags: readonly TagModel[],
  habits: readonly HabitModel[],
  entries: readonly HabitEntryModel[],
  today: string,
  query = '',
): TagCard[] {
  const active = habits.filter((h) => !h.isArchived);
  const doneToday = new Set(entries.filter((e) => !e.isArchived && localDay(e.completedAtUtc) === today).map((e) => e.habitId));
  const cards = tags.map((tag): TagCard => {
    const tagged = active.filter((h) => h.tags.some((t) => t.id === tag.id));
    let done = 0;
    let expected = 0;
    for (const habit of tagged) {
      const week = weekProgress(habit, entries, today);
      done += week.done;
      expected += week.expected;
    }
    return {
      id: tag.id,
      name: tag.name,
      description: tag.description ?? '',
      tone: tagTone(tag.id),
      habits: tagged.map((h) => ({ id: h.id, name: h.name, isDoneToday: doneToday.has(h.id) })),
      done,
      expected,
      percent: expected > 0 ? Math.round((done / expected) * 100) : null,
    };
  });
  return cards.filter((card) => matches(card, query));
}

export function tagsSummary(cards: readonly TagCard[]): { tags: number; habits: number } {
  const habits = new Set(cards.flatMap((card) => card.habits.map((h) => h.id)));
  return { tags: cards.length, habits: habits.size };
}

