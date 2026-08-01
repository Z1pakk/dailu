import { GithubEventType } from '@habits/enums/github-event-type.enum';
import { StravaActivityType } from '@habits/enums/strava-activity-type.enum';
import { GoogleHealthMetric } from '@habits/enums/google-health-metric.enum';

export interface GithubAutomationFilterModel {
  type: 'github';
  repositoryId: number;
  repositoryName: string;
  eventTypes: GithubEventType[];
}

export interface StravaAutomationFilterModel {
  type: 'strava';
  activityTypes: StravaActivityType[];
}

export interface GoogleHealthAutomationFilterModel {
  type: 'google-health';
  metrics: GoogleHealthMetric[];
}

export type AutomationFilterModel =
  | GithubAutomationFilterModel
  | StravaAutomationFilterModel
  | GoogleHealthAutomationFilterModel;
