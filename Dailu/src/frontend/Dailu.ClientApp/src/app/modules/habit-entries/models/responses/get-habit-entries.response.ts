import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';

export interface GetHabitEntriesResponseModel {
  habitEntries: HabitEntryModel[];
}