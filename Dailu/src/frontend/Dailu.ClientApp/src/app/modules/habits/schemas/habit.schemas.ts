import * as v from 'valibot';
import { HabitType, habitTypes } from '@habits/enums/habit-type.enum';
import { FrequencyType, frequencyTypes } from '@habits/enums/frequency-type.enum';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { GithubEventType, githubEventTypes } from '@habits/enums/github-event-type.enum';
import {
  StravaActivityType,
  stravaActivityTypes,
} from '@habits/enums/strava-activity-type.enum';
import {
  GoogleHealthMetric,
  googleHealthMetrics,
} from '@habits/enums/google-health-metric.enum';
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

/** "N times" for habits without days: at most 7 a week and 31 a month (one session a day). */
export const habitTimesPerPeriodSchema = (max: number, period: string) =>
  v.pipe(
    v.number('Times is required'),
    v.integer(),
    v.minValue(1, 'At least once'),
    v.maxValue(max, `At most ${max} times a ${period}`),
  );

export const HabitWeekDaysSchema = v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(6)));

export const HabitMonthDaysSchema = v.array(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(31)));

export const HabitDurationSchema = v.nullable(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1, 'Duration must be at least 1 minute'),
    v.maxValue(1440, 'Duration must be at most 24 hours'),
  ),
);

export const HabitAtSchema = v.date('Start time is required');

export const HabitTargetValueSchema = v.pipe(
  v.number(),
  v.minValue(0, 'Target value must be greater than or equal to 0'),
  v.maxValue(9999, 'Target value must be less than 9999'),
);

/** The drawer's "At least": empty means a binary habit. */
export const HabitTargetValueOptionalSchema = v.nullable(HabitTargetValueSchema);

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

export const HabitGithubRepositoryIdSchema = v.nullable(v.number());

export const HabitGithubRepositoryNameSchema = v.nullable(v.string());

export const HabitGithubEventTypesSchema = v.array(
  v.picklist(Object.values(githubEventTypes) as [GithubEventType, ...GithubEventType[]]),
);

export const HabitStravaActivityTypesSchema = v.array(
  v.picklist(
    Object.values(stravaActivityTypes) as [StravaActivityType, ...StravaActivityType[]],
  ),
);

export const HabitGoogleHealthMetricsSchema = v.array(
  v.picklist(
    Object.values(googleHealthMetrics) as [GoogleHealthMetric, ...GoogleHealthMetric[]],
  ),
);
