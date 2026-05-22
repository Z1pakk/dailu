import { WritableSignal } from '@angular/core';
import { Observable } from 'rxjs';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';

export type HabitEntryEditModalData = {
  entry: HabitEntryModel;
  $isFormValid: WritableSignal<boolean>;
  submit?: () => Observable<void>;
};
