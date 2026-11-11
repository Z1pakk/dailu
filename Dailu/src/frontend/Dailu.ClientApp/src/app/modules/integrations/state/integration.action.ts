import { IntegrationProviderType } from '@integrations/models/integration-summary.model';

const scope = '[Integration]';

/**
 * Get from cache or fetch from the api
 */
export class IntegrationGetSummaries {
  static readonly type = `${scope} GetSummaries`;
}

/**
 * Fetch from the api, e.g. after connecting a provider
 */
export class IntegrationFetchSummaries {
  static readonly type = `${scope} FetchSummaries`;
}

export class IntegrationRevoke {
  static readonly type = `${scope} Revoke`;

  constructor(public provider: IntegrationProviderType) {}
}

export class IntegrationGetGithubProfile {
  static readonly type = `${scope} GetGithubProfile`;
}

export class IntegrationFetchGithubProfile {
  static readonly type = `${scope} FetchGithubProfile`;
}

export class IntegrationGetGoogleHealthProfile {
  static readonly type = `${scope} GetGoogleHealthProfile`;
}

export class IntegrationFetchGoogleHealthProfile {
  static readonly type = `${scope} FetchGoogleHealthProfile`;
}
