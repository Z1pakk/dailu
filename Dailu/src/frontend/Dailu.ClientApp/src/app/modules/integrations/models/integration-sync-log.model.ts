export type IntegrationSyncStatus = 'success' | 'failed';

export interface IntegrationSyncLog {
  startedAtUtc: string;
  finishedAtUtc: string;
  status: IntegrationSyncStatus;
  activitiesCount: number;
  errorMessage: string | null;
}
