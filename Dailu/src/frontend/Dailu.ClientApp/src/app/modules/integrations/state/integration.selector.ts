import { createPropertySelectors } from '@ngxs/store';
import { IntegrationState, IntegrationStateModel } from '@integrations/state/integration.state';

export class IntegrationStateSelectors {
  static readonly getSlices = createPropertySelectors<IntegrationStateModel>(IntegrationState);
}
