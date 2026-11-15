import { HabitModel } from '@habits/models/habit.model';
import { CreateHabitRequestModel } from '@habits/models/requests/create-habit.request';
import { AutomationFilterModel } from '@habits/models/automation-filter.model';
import { TargetModel } from '@habits/models/target.model';
import { FrequencyModel } from '@habits/models/frequency.model';
import { TimingModel } from '@habits/models/timing.model';
import { DayOfWeek } from '@habits/enums/day-of-week.enum';
import { FrequencyType, frequencyTypes } from '@habits/enums/frequency-type.enum';
import { habitTypes } from '@habits/enums/habit-type.enum';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { GithubEventType, githubEventTypeLabels } from '@habits/enums/github-event-type.enum';
import { StravaActivityType, stravaActivityTypeLabels } from '@habits/enums/strava-activity-type.enum';
import { GoogleHealthMetric, googleHealthMetricLabels } from '@habits/enums/google-health-metric.enum';
import { hasFixedDays } from '@habits/lib/habit-schedule';
import { dateToTimeOfDay, timeOfDayToDate } from '@shared/lib/date/time-of-day';
import { toLocalDateString } from '@shared/lib/date/to-local-date-string';

/*
 * The habit drawer's form value, and how it maps to and from the API.
 * "At least" decides the habit type: an amount makes it measurable, empty makes it binary.
 */

export type TimeMode = 'any' | 'at';

export interface HabitDrawerValue {
  name: string;
  description: string;
  frequencyType: FrequencyType;
  /** Weekly only; empty = N times a week, any days. */
  weekDays: DayOfWeek[];
  /** Monthly only; empty = N times a month, any days. */
  monthDays: number[];
  /** Only used when no days are picked. */
  timesPerPeriod: number;
  timeMode: TimeMode;
  /** What the time picker binds to; only saved with "At a time" on a schedule with fixed days. */
  at: Date | null;
  durationMinutes: number | null;
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
    frequencyType: frequencyTypes.daily,
    weekDays: [],
    monthDays: [],
    timesPerPeriod: 1,
    timeMode: 'any',
    at: null,
    durationMinutes: null,
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
  const isMeasurable = habit.type === habitTypes.measurable;
  const filter = habit.automationFilter;
  return {
    ...empty,
    name: habit.name,
    description: habit.description ?? '',
    frequencyType: habit.frequency.type,
    weekDays: [...habit.frequency.weekDays],
    monthDays: [...habit.frequency.monthDays],
    timesPerPeriod: habit.frequency.timesPerPeriod,
    timeMode: habit.timing.at ? 'at' : 'any',
    at: habit.timing.at ? timeOfDayToDate(habit.timing.at) : null,
    durationMinutes: habit.timing.durationMinutes,
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

  const frequency = frequencyOf(value);

  return {
    name: value.name,
    description: value.description || null,
    type: isMeasurable ? habitTypes.measurable : habitTypes.binary,
    frequency,
    timing: timingOf(value, frequency),
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

const ascending = (a: number, b: number) => a - b;

/** Only the current type's days are sent, so a selection left over from another type never leaks. */
export function frequencyOf(value: HabitDrawerValue): FrequencyModel {
  const type = value.frequencyType;
  const frequency: FrequencyModel = {
    type,
    weekDays: type === frequencyTypes.weekly ? [...value.weekDays].sort(ascending) : [],
    monthDays: type === frequencyTypes.monthly ? [...value.monthDays].sort(ascending) : [],
    timesPerPeriod: 1,
  };
  return hasFixedDays(frequency) ? frequency : { ...frequency, timesPerPeriod: value.timesPerPeriod };
}

/** A time is only saved with "At a time" on a schedule with fixed days; the duration always is. */
export function timingOf(value: HabitDrawerValue, frequency: FrequencyModel): TimingModel {
  const at = value.timeMode === 'at' && hasFixedDays(frequency) && value.at ? dateToTimeOfDay(value.at) : null;
  return { at, durationMinutes: value.durationMinutes };
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
