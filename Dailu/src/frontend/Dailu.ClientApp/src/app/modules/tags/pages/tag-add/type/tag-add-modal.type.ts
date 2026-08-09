import { WritableSignal } from '@angular/core';
import { Observable } from 'rxjs';

export type TagAddModelData = {
  $isFormValid: WritableSignal<boolean>;
  submit?: () => Observable<void>;
};
