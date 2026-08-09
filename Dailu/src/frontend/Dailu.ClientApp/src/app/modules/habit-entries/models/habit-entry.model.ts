import { HabitEntrySource } from '@habit-entries/enums/habit-entry-source.enum';
import { HabitType } from '@habits/enums/habit-type.enum';

export interface HabitEntryModel {
  id: number;
  habitId: string;
  habitName: string;
  habitType: HabitType;
  value: number;
  notes: string | null;
  source: HabitEntrySource;
  externalId: string | null;
  completedAtUtc: string;
  isArchived: boolean;
  createdAtUtc: Date;
  updatedAtUtc: Date;
}