import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';

export function getRecentTrendValues(
  entries: HabitEntryModel[],
  habitId: string,
  limit = 20,
): number[] {
  return entries
    .filter((entry) => entry.habitId === habitId && !entry.isArchived)
    .sort(
      (a, b) => new Date(a.completedAtUtc).getTime() - new Date(b.completedAtUtc).getTime(),
    )
    .slice(-limit)
    .map((entry) => entry.value);
}
