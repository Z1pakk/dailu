import { IntegrationSummary } from '@integrations/models/integration-summary.model';

export interface GetIntegrationConfigsResponseModel {
  summaries: IntegrationSummary[];
}
