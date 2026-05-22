import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';
import { HabitType } from '@habits/enums/habit-type.enum';
import { FrequencyType } from '@habits/enums/frequency-type.enum';
import { AutomationSource } from '@habits/enums/automation-source.enum';
import {
  HabitNameSchema,
  HabitDescriptionSchema,
  HabitTypeSchema,
  HabitFrequencyTypeSchema,
  HabitFrequencyTimesPerPeriodSchema,
  HabitTargetValueSchema,
  HabitTargetUnitSchema,
  HabitMilestoneTargetSchema,
  HabitEndDateSchema,
  HabitTagIdsSchema,
  HabitAutomationSourceSchema,
} from '@habits/schemas/habit.schemas';

export const HabitAddFormSchema = v.object({
  name: HabitNameSchema,
  description: HabitDescriptionSchema,
  type: HabitTypeSchema,
  frequencyType: HabitFrequencyTypeSchema,
  frequencyTimesPerPeriod: HabitFrequencyTimesPerPeriodSchema,
  targetValue: HabitTargetValueSchema,
  targetUnit: HabitTargetUnitSchema,
  endDate: HabitEndDateSchema,
  milestoneTarget: HabitMilestoneTargetSchema,
  tagIds: HabitTagIdsSchema,
  automationSource: HabitAutomationSourceSchema,
});

export type HabitAddFormValue = v.InferOutput<typeof HabitAddFormSchema>;

export type HabitAddForm = {
  name: FormControl<string>;
  description: FormControl<string>;
  type: FormControl<HabitType>;
  frequencyType: FormControl<FrequencyType>;
  frequencyTimesPerPeriod: FormControl<number>;
  targetValue: FormControl<number>;
  targetUnit: FormControl<string>;
  endDate: FormControl<Date | null>;
  milestoneTarget: FormControl<number | null>;
  tagIds: FormControl<string[]>;
  automationSource: FormControl<AutomationSource | null>;
};

export type HabitAddFormGroup = FormGroup<HabitAddForm>;
