import { AccessTokenModel } from '@auth/models/access-token.model';

export interface RegisterResponse {
  accessTokens: AccessTokenModel;
}
