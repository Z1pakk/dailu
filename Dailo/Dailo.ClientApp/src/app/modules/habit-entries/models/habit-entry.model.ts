import { HabitEntrySource } from '@habit-entries/enums/habit-entry-source.enum';

export interface HabitEntryModel {
  id: number;
  habitId: string;
  habitName: string;
  value: number;
  notes: string | null;
  source: HabitEntrySource;
  externalId: string | null;
  date: Date;
  isArchived: boolean;
  createdAtUtc: Date;
  updatedAtUtc: Date;
}