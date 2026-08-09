import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';
import {
  HabitEntryHabitIdSchema,
  HabitEntryValueSchema,
  HabitEntryNotesSchema,
  HabitEntryCompletedAtSchema,
} from '@habit-entries/schemas/habit-entry.schemas';

export const HabitEntryAddFormSchema = v.object({
  habitId: HabitEntryHabitIdSchema,
  value: HabitEntryValueSchema,
  notes: HabitEntryNotesSchema,
  completedAt: HabitEntryCompletedAtSchema,
  includeTime: v.boolean(),
});

export type HabitEntryAddFormValue = v.InferOutput<
  typeof HabitEntryAddFormSchema
>;

export type HabitEntryAddForm = {
  habitId: FormControl<string>;
  value: FormControl<number>;
  notes: FormControl<string>;
  completedAt: FormControl<Date>;
  includeTime: FormControl<boolean>;
};

export type HabitEntryAddFormGroup = FormGroup<HabitEntryAddForm>;
