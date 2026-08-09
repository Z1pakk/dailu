import { AccessTokenModel } from '@auth/models/access-token.model';

export interface LoginResponse {
  accessTokens: AccessTokenModel;
}
