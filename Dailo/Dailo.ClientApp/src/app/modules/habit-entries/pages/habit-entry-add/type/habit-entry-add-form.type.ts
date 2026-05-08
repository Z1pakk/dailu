import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';
import {
  HabitEntryHabitIdSchema,
  HabitEntryValueSchema,
  HabitEntryNotesSchema,
  HabitEntryDateSchema,
} from '@habit-entries/schemas/habit-entry.schemas';

export const HabitEntryAddFormSchema = v.object({
  habitId: HabitEntryHabitIdSchema,
  value: HabitEntryValueSchema,
  notes: HabitEntryNotesSchema,
  date: HabitEntryDateSchema,
});

export type HabitEntryAddFormValue = v.InferOutput<
  typeof HabitEntryAddFormSchema
>;

export type HabitEntryAddForm = {
  habitId: FormControl<string>;
  value: FormControl<number>;
  notes: FormControl<string>;
  date: FormControl<Date>;
};

export type HabitEntryAddFormGroup = FormGroup<HabitEntryAddForm>;
