import { IntegrationSyncLog } from '@user-profile/models/integration-sync-log.model';

export interface GetIntegrationSyncLogsResponseModel {
  logs: IntegrationSyncLog[];
}
