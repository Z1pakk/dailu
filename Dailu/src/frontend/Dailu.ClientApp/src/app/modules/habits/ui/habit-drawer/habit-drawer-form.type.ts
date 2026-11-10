import { FormControl, FormGroup } from '@angular/forms';
import { HabitDrawerValue } from '@habits/lib/habit-form-mapping';

export type HabitDrawerFormControls = {
  [K in keyof HabitDrawerValue]: FormControl<HabitDrawerValue[K]>;
};

export type HabitDrawerFormGroup = FormGroup<HabitDrawerFormControls>;
