import { createPropertySelectors } from '@ngxs/store';
import { AuthState, AuthStateModel } from '@auth/state/auth.state';

export class AuthStateSelectors {
  static readonly getSlices =
    createPropertySelectors<AuthStateModel>(AuthState);
}
