import { IntegrationSyncLog } from '@user-profile/models/integration-sync-log.model';

interface IntegrationSummaryBase {
  lastSync: IntegrationSyncLog | null;
}

export interface GithubIntegrationSummary extends IntegrationSummaryBase {
  type: 'github';
  expiresAtUtc: string | null; // ISO datetime; null = never expires
}

export interface StravaAthleteInfo {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  profileUrl: string;
}

export interface StravaIntegrationSummary extends IntegrationSummaryBase {
  type: 'strava';
  expiresAtUtc: string;
  athlete: StravaAthleteInfo | null;
}

export interface GoogleHealthIntegrationSummary extends IntegrationSummaryBase {
  type: 'google-health';
  expiresAtUtc: string;
}

export type IntegrationSummary = GithubIntegrationSummary | StravaIntegrationSummary | GoogleHealthIntegrationSummary;

export type IntegrationProviderType = IntegrationSummary['type'];
