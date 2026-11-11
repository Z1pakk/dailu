import { UpdateUserProfileRequestModel } from '@user-profile/models/requests/update-user-profile.request';

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
