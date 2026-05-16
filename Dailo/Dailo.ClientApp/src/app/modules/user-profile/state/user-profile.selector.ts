import { createPropertySelectors } from '@ngxs/store';
import {
  UserProfileState,
  UserProfileStateModel,
} from '@user-profile/state/user-profile.state';

export class UserProfileStateSelectors {
  static readonly getSlices =
    createPropertySelectors<UserProfileStateModel>(UserProfileState);
}
