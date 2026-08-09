export interface CreateHabitEntryRequestModel {
  habitId: string;
  value: number;
  notes: string | null;
  completedAt: string;
}
