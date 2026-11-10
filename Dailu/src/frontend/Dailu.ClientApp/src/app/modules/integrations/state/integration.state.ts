import { inject, Injectable } from '@angular/core';
import { Action, State, StateContext } from '@ngxs/store';
import { catchError, EMPTY, finalize, of, tap } from 'rxjs';
import { IntegrationApi } from '@integrations/api/integration.api';
import { IntegrationSummary } from '@integrations/models/integration-summary.model';
import { GitHubUserProfileModel } from '@integrations/models/github-user-profile.model';
import { GoogleHealthUserProfileModel } from '@integrations/models/google-health-user-profile.model';
import {
  IntegrationFetchGithubProfile,
  IntegrationFetchGoogleHealthProfile,
  IntegrationFetchSummaries,
  IntegrationGetGithubProfile,
  IntegrationGetGoogleHealthProfile,
  IntegrationGetSummaries,
  IntegrationRevoke,
} from '@integrations/state/integration.action';

export interface IntegrationStateModel {
  isLoading: boolean;
  /** null until loaded. */
  summaries: IntegrationSummary[] | null;
  githubProfile: GitHubUserProfileModel | null;
  githubProfileError: boolean;
  googleHealthProfile: GoogleHealthUserProfileModel | null;
  googleHealthProfileError: boolean;
}

const defaults: IntegrationStateModel = {
  isLoading: false,
  summaries: null,
  githubProfile: null,
  githubProfileError: false,
  googleHealthProfile: null,
  googleHealthProfileError: false,
};

@Injectable()
@State<IntegrationStateModel>({
  name: 'integrations',
  defaults,
})
export class IntegrationState {
  private readonly _api = inject(IntegrationApi);

  @Action(IntegrationGetSummaries)
  public getSummaries(ctx: StateContext<IntegrationStateModel>) {
    const { summaries } = ctx.getState();
    if (summaries !== null) {
      return of(summaries);
    }
    return ctx.dispatch(new IntegrationFetchSummaries());
  }

  @Action(IntegrationFetchSummaries)
  public fetchSummaries(ctx: StateContext<IntegrationStateModel>) {
    ctx.patchState({ isLoading: true });
    return this._api.getSummaries().pipe(
      tap((response) => ctx.patchState({ summaries: response.summaries })),
      finalize(() => ctx.patchState({ isLoading: false })),
    );
  }

  @Action(IntegrationRevoke)
  public revoke(ctx: StateContext<IntegrationStateModel>, action: IntegrationRevoke) {
    return this._api.revoke(action.provider).pipe(
      tap(() => {
        const { summaries } = ctx.getState();
        ctx.patchState({
          summaries: summaries?.filter((s) => s.type !== action.provider) ?? null,
          ...(action.provider === 'github' ? { githubProfile: null, githubProfileError: false } : {}),
          ...(action.provider === 'google-health' ? { googleHealthProfile: null, googleHealthProfileError: false } : {}),
        });
      }),
    );
  }

  @Action(IntegrationGetGithubProfile)
  public getGithubProfile(ctx: StateContext<IntegrationStateModel>) {
    const { githubProfile } = ctx.getState();
    if (githubProfile !== null) {
      return of(githubProfile);
    }
    return ctx.dispatch(new IntegrationFetchGithubProfile());
  }

  @Action(IntegrationFetchGithubProfile)
  public fetchGithubProfile(ctx: StateContext<IntegrationStateModel>) {
    ctx.patchState({ githubProfileError: false });
    return this._api.getGithubProfile().pipe(
      tap((response) => ctx.patchState({ githubProfile: response.profile })),
      catchError(() => {
        ctx.patchState({ githubProfileError: true });
        return EMPTY;
      }),
    );
  }

  @Action(IntegrationGetGoogleHealthProfile)
  public getGoogleHealthProfile(ctx: StateContext<IntegrationStateModel>) {
    const { googleHealthProfile } = ctx.getState();
    if (googleHealthProfile !== null) {
      return of(googleHealthProfile);
    }
    return ctx.dispatch(new IntegrationFetchGoogleHealthProfile());
  }

  @Action(IntegrationFetchGoogleHealthProfile)
  public fetchGoogleHealthProfile(ctx: StateContext<IntegrationStateModel>) {
    ctx.patchState({ googleHealthProfileError: false });
    return this._api.getGoogleHealthProfile().pipe(
      tap((response) => ctx.patchState({ googleHealthProfile: response.profile })),
      catchError(() => {
        ctx.patchState({ googleHealthProfileError: true });
        return EMPTY;
      }),
    );
  }
}
