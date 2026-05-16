import { UpdateUserProfileRequestModel } from '@user-profile/models/requests/update-user-profile.request';
import { IntegrationConfig } from '@user-profile/models/integration-config.model';

const scope = '[UserProfile]';

export class UserProfileGetProfile {
  static readonly type = `${scope} GetProfile`;
}

export class UserProfileFetchProfile {
  static readonly type = `${scope} FetchProfile`;
}

export class UserProfileUpdateProfile {
  static readonly type = `${scope} UpdateProfile`;

  constructor(public payload: UpdateUserProfileRequestModel) {}
}

export class UserProfileGetIntegrationConfigs {
  static readonly type = `${scope} GetIntegrationConfigs`;
}

export class UserProfileFetchIntegrationConfigs {
  static readonly type = `${scope} FetchIntegrationConfigs`;
}

export class UserProfileSaveIntegrationConfig {
  static readonly type = `${scope} SaveIntegrationConfig`;

  constructor(public payload: IntegrationConfig) {}
}

export class UserProfileRevokeIntegrationConfig {
  static readonly type = `${scope} RevokeIntegrationConfig`;

  constructor(public provider: string) {}
}

export class UserProfileGetGithubProfile {
  static readonly type = `${scope} GetGithubProfile`;
}

export class UserProfileFetchGithubProfile {
  static readonly type = `${scope} FetchGithubProfile`;
}
