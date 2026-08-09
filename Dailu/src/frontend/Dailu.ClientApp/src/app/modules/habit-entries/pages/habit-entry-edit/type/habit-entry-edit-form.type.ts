import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';
import {
  HabitEntryValueSchema,
  HabitEntryNotesSchema,
  HabitEntryCompletedAtSchema,
} from '@habit-entries/schemas/habit-entry.schemas';

export const HabitEntryEditFormSchema = v.object({
  value: HabitEntryValueSchema,
  notes: HabitEntryNotesSchema,
  completedAt: HabitEntryCompletedAtSchema,
  includeTime: v.boolean(),
});

export type HabitEntryEditFormValue = v.InferOutput<typeof HabitEntryEditFormSchema>;

export type HabitEntryEditForm = {
  value: FormControl<number>;
  notes: FormControl<string>;
  completedAt: FormControl<Date>;
  includeTime: FormControl<boolean>;
};

export type HabitEntryEditFormGroup = FormGroup<HabitEntryEditForm>;
