import { CreateHabitEntryRequestModel } from '@habit-entries/models/requests/create-habit-entry.request';
import { UpdateHabitEntryRequestModel } from '@habit-entries/models/requests/update-habit-entry.request';

const scope = '[HabitEntry]';

export class HabitEntryGetHabitEntries {
  static readonly type = `${scope} GetHabitEntries`;
}

export class HabitEntryCreateHabitEntry {
  static readonly type = `${scope} CreateHabitEntry`;
  constructor(public payload: CreateHabitEntryRequestModel) {}
}

export class HabitEntryUpdateHabitEntry {
  static readonly type = `${scope} UpdateHabitEntry`;
  constructor(public id: number, public payload: UpdateHabitEntryRequestModel) {}
}