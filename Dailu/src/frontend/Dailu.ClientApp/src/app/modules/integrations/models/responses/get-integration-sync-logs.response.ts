import { IntegrationSyncLog } from '@integrations/models/integration-sync-log.model';

export interface GetIntegrationSyncLogsResponseModel {
  logs: IntegrationSyncLog[];
}
