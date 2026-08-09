import { WritableSignal } from '@angular/core';
import { Observable } from 'rxjs';
import { HabitModel } from '@habits/models/habit.model';

export type HabitEditModalData = {
  habit: HabitModel;
  $isFormValid: WritableSignal<boolean>;
  submit?: () => Observable<void>;
};
