import { WritableSignal } from '@angular/core';
import { Observable } from 'rxjs';

export type HabitEntryAddModalData = {
  $isFormValid: WritableSignal<boolean>;
  submit?: () => Observable<void>;
};