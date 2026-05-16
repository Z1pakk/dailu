import { inject, Injectable } from '@angular/core';
import { Action, State, StateContext } from '@ngxs/store';
import { UserProfileModel } from '@user-profile/models/user-profile.model';
import {
  GithubIntegrationSummary,
  IntegrationSummary,
} from '@user-profile/models/integration-summary.model';
import { GithubIntegrationConfig } from '@user-profile/models/integration-config.model';
import {
  UserProfileFetchIntegrationConfigs,
  UserProfileFetchProfile,
  UserProfileGetIntegrationConfigs,
  UserProfileGetProfile,
  UserProfileRevokeIntegrationConfig,
  UserProfileSaveIntegrationConfig,
  UserProfileUpdateProfile,
} from '@user-profile/state/user-profile.action';
import { UserProfileApi } from '@user-profile/api/user-profile.api';
import { finalize, of, tap } from 'rxjs';

export interface UserProfileStateModel {
  isLoading: boolean;
  isLoadingIntegrations: boolean;
  isSavingIntegration: boolean;
  profile: UserProfileModel | null;
  integrationSummaries: IntegrationSummary[] | null;
}

const defaultState: UserProfileStateModel = {
  isLoading: false,
  isLoadingIntegrations: false,
  isSavingIntegration: false,
  profile: null,
  integrationSummaries: null,
};

@Injectable()
@State<UserProfileStateModel>({
  name: 'userProfile',
  defaults: defaultState,
})
export class UserProfileState {
  private readonly _api = inject(UserProfileApi);

  @Action(UserProfileGetProfile)
  public getProfile(ctx: StateContext<UserProfileStateModel>) {
    const { profile } = ctx.getState();
    if (profile !== null) {
      return of(profile);
    }

    return ctx.dispatch(new UserProfileFetchProfile());
  }

  @Action(UserProfileFetchProfile)
  public fetchProfile(ctx: StateContext<UserProfileStateModel>) {
    ctx.patchState({ isLoading: true });

    return this._api.get().pipe(
      tap({
        next: (response) => {
          ctx.patchState({ profile: response.profile });
        },
      }),
      finalize(() => ctx.patchState({ isLoading: false })),
    );
  }

  @Action(UserProfileUpdateProfile)
  public updateProfile(
    ctx: StateContext<UserProfileStateModel>,
    action: UserProfileUpdateProfile,
  ) {
    ctx.patchState({ isLoading: true });

    return this._api.update(action.payload).pipe(
      tap({
        next: () => {
          const { profile } = ctx.getState();
          if (profile) {
            ctx.patchState({
              profile: { ...profile, ...action.payload },
            });
          }
        },
      }),
      finalize(() => ctx.patchState({ isLoading: false })),
    );
  }

  @Action(UserProfileGetIntegrationConfigs)
  public getIntegrationConfigs(ctx: StateContext<UserProfileStateModel>) {
    const { integrationSummaries } = ctx.getState();
    if (integrationSummaries !== null) {
      return of(integrationSummaries);
    }

    return ctx.dispatch(new UserProfileFetchIntegrationConfigs());
  }

  @Action(UserProfileFetchIntegrationConfigs)
  public fetchIntegrationConfigs(ctx: StateContext<UserProfileStateModel>) {
    ctx.patchState({ isLoadingIntegrations: true });

    return this._api.getIntegrationConfigs().pipe(
      tap({
        next: (response) => {
          ctx.patchState({ integrationSummaries: response.summaries });
        },
      }),
      finalize(() => ctx.patchState({ isLoadingIntegrations: false })),
    );
  }

  @Action(UserProfileRevokeIntegrationConfig)
  public revokeIntegrationConfig(
    ctx: StateContext<UserProfileStateModel>,
    action: UserProfileRevokeIntegrationConfig,
  ) {
    return this._api.revokeIntegrationConfig(action.provider).pipe(
      tap({
        next: () => {
          const { integrationSummaries } = ctx.getState();
          if (integrationSummaries !== null) {
            ctx.patchState({
              integrationSummaries: integrationSummaries.filter(
                (s) => s.type !== action.provider,
              ),
            });
          }
        },
      }),
    );
  }

  @Action(UserProfileSaveIntegrationConfig)
  public saveIntegrationConfig(
    ctx: StateContext<UserProfileStateModel>,
    action: UserProfileSaveIntegrationConfig,
  ) {
    ctx.patchState({ isSavingIntegration: true });

    return this._api.saveIntegrationConfig(action.payload).pipe(
      tap({
        next: () => {
          const { integrationSummaries } = ctx.getState();
          if (integrationSummaries !== null) {
            const summary = buildSummary(action.payload);
            const rest = integrationSummaries.filter(
              (s) => s.type !== action.payload.type,
            );
            ctx.patchState({ integrationSummaries: [...rest, summary] });
          }
        },
      }),
      finalize(() => ctx.patchState({ isSavingIntegration: false })),
    );
  }
}

function buildSummary(config: UserProfileSaveIntegrationConfig['payload']): IntegrationSummary {
  if (config.type === 'github') {
    const { expiresInDays } = config as GithubIntegrationConfig;
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    return { type: 'github', expiresAt } satisfies GithubIntegrationSummary;
  }

  return { type: config.type };
}
