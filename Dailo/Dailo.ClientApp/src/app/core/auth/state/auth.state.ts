import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Action, NgxsOnInit, State, StateContext, Store } from '@ngxs/store';
import {
  AuthLogin,
  AuthLogout,
  AuthLogoutLocal,
  AuthRefresh,
  AuthRegister,
} from '@auth/state/auth.action';
import { AuthApi } from '@auth/auth.api';
import { finalize, tap } from 'rxjs';
import { LoginResponse } from '@auth/responses/login.response';
import { RegisterResponse } from '@auth/responses/register.response';
import { RefreshResponse } from '@auth/responses/refresh.response';
import { BroadcastService } from '@core/services/broadcast.service';

const LOGOUT_CHANNEL = 'auth';
const LOGOUT_MESSAGE = 'logout';

export interface AuthStateModel {
  isLoading: boolean;
  isAuthenticated: boolean;
  authToken: string;
}

const defaultState: AuthStateModel = {
  isLoading: false,
  isAuthenticated: false,
  authToken: '',
};

@Injectable()
@State<AuthStateModel>({ name: 'authState', defaults: defaultState })
export class AuthState implements NgxsOnInit {
  private readonly _authApi = inject(AuthApi);
  private readonly _router = inject(Router);
  private readonly _broadcastService = inject(BroadcastService);
  private readonly _store = inject(Store);

  ngxsOnInit(ctx: StateContext<AuthStateModel>): void {
    this.watchLogout();
  }

  private watchLogout(): void {
    this._broadcastService.messages$(LOGOUT_CHANNEL).subscribe((msg) => {
      if (msg === LOGOUT_MESSAGE) {
        this._store.dispatch(new AuthLogoutLocal());
      }
    });
  }

  @Action(AuthLogin)
  public login(ctx: StateContext<AuthStateModel>, action: AuthLogin) {
    ctx.patchState({
      isLoading: true,
    });

    return this._authApi.login(action.payload).pipe(
      tap({
        next: (result: LoginResponse) => {
          ctx.patchState({
            isAuthenticated: true,
            authToken: result.accessTokens.accessToken,
          });
        },
      }),
      finalize(() => ctx.patchState({ isLoading: false })),
    );
  }

  @Action(AuthRegister)
  public register(ctx: StateContext<AuthStateModel>, action: AuthRegister) {
    ctx.patchState({
      isLoading: true,
    });

    return this._authApi.register(action.payload).pipe(
      tap({
        next: (result: RegisterResponse) => {
          ctx.patchState({
            isAuthenticated: true,
            authToken: result.accessTokens.accessToken,
          });
        },
      }),
      finalize(() => ctx.patchState({ isLoading: false })),
    );
  }

  @Action(AuthRefresh)
  public refresh(ctx: StateContext<AuthStateModel>, _: AuthRefresh) {
    ctx.patchState({
      isLoading: true,
    });

    return this._authApi.refresh().pipe(
      tap({
        next: (result: RefreshResponse) => {
          ctx.patchState({
            isAuthenticated: true,
            authToken: result.accessTokens.accessToken,
          });
        },
      }),
      finalize(() => ctx.patchState({ isLoading: false })),
    );
  }

  @Action(AuthLogoutLocal)
  public logoutLocal(ctx: StateContext<AuthStateModel>) {
    ctx.setState(defaultState);
    this._router.navigate(['/login']);
  }

  @Action(AuthLogout)
  public logout(ctx: StateContext<AuthStateModel>) {
    ctx.patchState({ isLoading: true });

    return this._authApi.logout().pipe(
      tap({
        next: () => {
          ctx.setState(defaultState);
          this._broadcastService.post(LOGOUT_CHANNEL, LOGOUT_MESSAGE);
        },
        error: () => ctx.setState(defaultState),
      }),
      finalize(() => {
        ctx.patchState({ isLoading: false });
        this._router.navigate(['/login']);
      }),
    );
  }
}
