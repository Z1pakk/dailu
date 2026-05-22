import * as v from 'valibot';
import { HabitType, habitTypes } from '@habits/enums/habit-type.enum';
import { FrequencyType, frequencyTypes } from '@habits/enums/frequency-type.enum';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { notBlank, notBlankOptional } from '@shared/lib/form/not-blank';

export const HabitNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Name is required'),
  notBlank(),
  v.maxLength(100, 'Maximum of 100 characters'),
);

export const HabitDescriptionSchema = v.pipe(
  v.string(),
  notBlankOptional(),
  v.maxLength(500, 'Maximum of 500 characters'),
);

export const HabitTypeSchema = v.picklist(
  Object.values(habitTypes) as [HabitType, ...HabitType[]],
  'Type is required',
);

export const HabitFrequencyTypeSchema = v.picklist(
  Object.values(frequencyTypes) as [FrequencyType, ...FrequencyType[]],
  'Frequency Type is required',
);

export const HabitFrequencyTimesPerPeriodSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1, 'Times per period must be greater than 0'),
  v.maxValue(999, 'Times per period must be less than 999'),
);

export const HabitTargetValueSchema = v.pipe(
  v.number(),
  v.minValue(0, 'Target value must be greater than or equal to 0'),
  v.maxValue(9999, 'Target value must be less than 9999'),
);

export const HabitTargetUnitSchema = v.pipe(
  v.string(),
  v.nonEmpty('Unit is required'),
  notBlank(),
  v.maxLength(100, 'Maximum of 100 characters'),
);

export const HabitMilestoneTargetSchema = v.nullable(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1, 'Milestone target must be greater than 0'),
    v.maxValue(9999, 'Milestone target must be less than 9999'),
  ),
);

export const HabitEndDateSchema = v.nullable(
  v.pipe(
    v.date(),
    v.check(
      (date) => date >= new Date(new Date().setHours(0, 0, 0, 0)),
      'End date must be today or in the future',
    ),
  ),
);

export const HabitTagIdsSchema = v.array(v.string());

export const HabitAutomationSourceSchema = v.nullable(
  v.picklist(
    Object.values(automationSources) as [AutomationSource, ...AutomationSource[]],
  ),
);
