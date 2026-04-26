import { LoginRequest } from '@auth/requests/login.request';
import { RegisterRequest } from '@auth/requests/register.request';

const scope = '[Auth]';

export class AuthLogin {
  constructor(public payload: LoginRequest) {}

  static readonly type = `${scope} Login`;
}

export class AuthRegister {
  constructor(public payload: RegisterRequest) {}

  static readonly type = `${scope} Register`;
}

export class AuthRefresh {
  static readonly type = `${scope} Refresh`;
}

export class AuthLogout {
  static readonly type = `${scope} Logout`;
}
