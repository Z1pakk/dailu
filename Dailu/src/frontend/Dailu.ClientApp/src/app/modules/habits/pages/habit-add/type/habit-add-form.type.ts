import * as v from 'valibot';
import { HabitFormFields, HabitFormGroup } from '@habits/types/habit-form.type';
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
  HabitGithubRepositoryIdSchema,
  HabitGithubRepositoryNameSchema,
  HabitGithubEventTypesSchema,
  HabitStravaActivityTypesSchema,
  HabitGoogleHealthMetricsSchema,
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
  githubRepositoryId: HabitGithubRepositoryIdSchema,
  githubRepositoryName: HabitGithubRepositoryNameSchema,
  githubEventTypes: HabitGithubEventTypesSchema,
  stravaActivityTypes: HabitStravaActivityTypesSchema,
  googleHealthMetrics: HabitGoogleHealthMetricsSchema,
});

export type HabitAddFormValue = v.InferOutput<typeof HabitAddFormSchema>;

export type HabitAddForm = HabitFormFields;

export type HabitAddFormGroup = HabitFormGroup;
