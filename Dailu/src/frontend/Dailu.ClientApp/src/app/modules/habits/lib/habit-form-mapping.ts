import { HabitModel } from '@habits/models/habit.model';
import { CreateHabitRequestModel } from '@habits/models/requests/create-habit.request';
import { AutomationFilterModel } from '@habits/models/automation-filter.model';
import { TargetModel } from '@habits/models/target.model';
import { FrequencyType, frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { GithubEventType, githubEventTypeLabels } from '@habits/enums/github-event-type.enum';
import { StravaActivityType, stravaActivityTypeLabels } from '@habits/enums/strava-activity-type.enum';
import { GoogleHealthMetric, googleHealthMetricLabels } from '@habits/enums/google-health-metric.enum';
import { frequencyFor, ScheduleMode, scheduleModeOf } from '@habits/lib/habit-schedule';
import { toLocalDateString } from '@shared/lib/date/to-local-date-string';

/*
 * The habit drawer's form value, and how it maps to and from the API.
 * "At least" decides the habit type: an amount makes it measurable, empty makes it binary.
 */

export interface HabitDrawerValue {
  name: string;
  description: string;
  scheduleMode: ScheduleMode;
  customFrequencyType: FrequencyType;
  customTimesPerPeriod: number;
  targetValue: number | null;
  targetUnit: string;
  endDate: Date | null;
  milestoneTarget: number | null;
  tagIds: string[];
  automationSource: AutomationSource;
  githubRepositoryId: number | null;
  githubRepositoryName: string | null;
  githubEventTypes: GithubEventType[];
  stravaActivityTypes: StravaActivityType[];
  googleHealthMetrics: GoogleHealthMetric[];
}

/** What the old form saved for a binary habit; the backend still requires a target. */
const BINARY_TARGET: TargetModel = { value: 1, unit: 'Session' };

// Polling intervals of the backend integration workers (HabitUser.<Provider>/Workers).
const CHECK_INTERVAL_MIN: Partial<Record<AutomationSource, number>> = {
  [automationSources.github]: 2,
  [automationSources.strava]: 5,
  [automationSources.googleHealth]: 5,
};

export function emptyDrawerValue(): HabitDrawerValue {
  return {
    name: '',
    description: '',
    scheduleMode: 'daily',
    customFrequencyType: frequencyTypes.weekly,
    customTimesPerPeriod: 3,
    targetValue: null,
    targetUnit: '',
    endDate: null,
    milestoneTarget: null,
    tagIds: [],
    automationSource: automationSources.none,
    githubRepositoryId: null,
    githubRepositoryName: null,
    githubEventTypes: [],
    stravaActivityTypes: [],
    googleHealthMetrics: [],
  };
}

export function drawerValueFromHabit(habit: HabitModel): HabitDrawerValue {
  const empty = emptyDrawerValue();
  const scheduleMode = scheduleModeOf(habit.frequency);
  const isMeasurable = habit.type === habitTypes.measurable;
  const filter = habit.automationFilter;
  return {
    ...empty,
    name: habit.name,
    description: habit.description ?? '',
    scheduleMode,
    customFrequencyType: scheduleMode === 'custom' ? habit.frequency.type : empty.customFrequencyType,
    customTimesPerPeriod: scheduleMode === 'custom' ? habit.frequency.timesPerPeriod : empty.customTimesPerPeriod,
    targetValue: isMeasurable ? habit.target.value : null,
    targetUnit: isMeasurable ? habit.target.unit : '',
    endDate: habit.endDate ? new Date(habit.endDate) : null,
    milestoneTarget: habit.milestone?.target ?? null,
    tagIds: habit.tags.map((t) => t.id),
    automationSource: habit.automationSource ?? automationSources.none,
    githubRepositoryId: filter?.type === 'github' ? filter.repositoryId : null,
    githubRepositoryName: filter?.type === 'github' ? filter.repositoryName : null,
    githubEventTypes: filter?.type === 'github' ? filter.eventTypes : [],
    stravaActivityTypes: filter?.type === 'strava' ? filter.activityTypes : [],
    googleHealthMetrics: filter?.type === 'google-health' ? filter.metrics : [],
  };
}

function buildFilter(value: HabitDrawerValue): AutomationFilterModel | null {
  const source = value.automationSource;
  if (source === automationSources.github) {
    if (value.githubRepositoryId === null || value.githubRepositoryName === null) {
      return null;
    }
    return {
      type: 'github',
      repositoryId: value.githubRepositoryId,
      repositoryName: value.githubRepositoryName,
      eventTypes: value.githubEventTypes,
    };
  }
  if (source === automationSources.strava) {
    return { type: 'strava', activityTypes: value.stravaActivityTypes };
  }
  if (source === automationSources.googleHealth) {
    return { type: 'google-health', metrics: value.googleHealthMetrics };
  }
  return null;
}

export function toHabitRequest(value: HabitDrawerValue, existing: HabitModel | null): CreateHabitRequestModel {
  const isManual = value.automationSource === automationSources.none;
  const isMeasurable = value.targetValue !== null && value.targetValue > 0;

  let target = BINARY_TARGET;
  if (isMeasurable) {
    target = { value: value.targetValue!, unit: value.targetUnit.trim() };
  } else if (existing?.type === habitTypes.binary) {
    target = existing.target;
  }

  // A disconnected integration can leave the form unable to rebuild the filter: keep the stored one.
  let automationFilter = buildFilter(value);
  if (!automationFilter && !isManual && existing?.automationSource === value.automationSource) {
    automationFilter = existing.automationFilter ?? null;
  }

  return {
    name: value.name,
    description: value.description || null,
    type: isMeasurable ? habitTypes.measurable : habitTypes.binary,
    frequency: frequencyFor(value.scheduleMode, {
      type: value.customFrequencyType,
      timesPerPeriod: value.customTimesPerPeriod,
    }),
    target,
    endDate: value.endDate ? toLocalDateString(value.endDate) : null,
    milestone:
      value.milestoneTarget === null
        ? null
        : { target: value.milestoneTarget, current: existing?.milestone?.current ?? 0 },
    tagIds: value.tagIds,
    automationSource: isManual ? null : value.automationSource,
    automationFilter,
  };
}

function joinOr(labels: string[], fallback: string): string {
  return labels.length > 0 ? labels.join(' or ') : fallback;
}

/** The auto-check info box. Never promises a minimum or a time window — the backend checks neither. */
export function autoCheckSummary(value: HabitDrawerValue): string | null {
  const minutes = CHECK_INTERVAL_MIN[value.automationSource];
  if (minutes === undefined) {
    return null;
  }
  const prefix = `Checked every ${minutes} min.`;

  if (value.automationSource === automationSources.github) {
    const events = joinOr(
      value.githubEventTypes.map((e) => githubEventTypeLabels[e].toLowerCase()),
      'push or pull request',
    );
    return `${prefix} Any ${events} to ${value.githubRepositoryName ?? 'your repository'} ticks this habit.`;
  }
  if (value.automationSource === automationSources.strava) {
    const types = joinOr(
      value.stravaActivityTypes.map((t) => stravaActivityTypeLabels[t].toLowerCase()),
      'activity',
    );
    return `${prefix} Any Strava ${types} ticks this habit.`;
  }
  const metrics = joinOr(
    value.googleHealthMetrics.map((m) => googleHealthMetricLabels[m].toLowerCase()),
    'activity',
  );
  return `${prefix} Any Google Health ${metrics} ticks this habit.`;
}
