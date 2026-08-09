import { AccessTokenModel } from '@auth/models/access-token.model';

export interface RefreshResponse {
  accessTokens: AccessTokenModel;
}
