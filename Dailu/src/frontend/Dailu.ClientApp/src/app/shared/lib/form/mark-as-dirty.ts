import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

export function markAllAsDirty(control: AbstractControl): void {
  if (control instanceof FormGroup) {
    for (const c of Object.values(control.controls)) {
      markAllAsDirty(c);
    }
  }

  if (control instanceof FormArray) {
    for (const c of Object.values(control.controls)) {
      markAllAsDirty(c);
    }
  }

  control.markAsTouched();
  control.markAsDirty();
}
