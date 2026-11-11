import { inject, Injectable } from '@angular/core';
import { Action, State, StateContext } from '@ngxs/store';
import { UserProfileModel } from '@user-profile/models/user-profile.model';
import {
  UserProfileFetchProfile,
  UserProfileGetProfile,
  UserProfileUpdateProfile,
} from '@user-profile/state/user-profile.action';
import { UserProfileApi } from '@user-profile/api/user-profile.api';
import { finalize, of, tap } from 'rxjs';

export interface UserProfileStateModel {
  isLoading: boolean;
  profile: UserProfileModel | null;
}

const defaultState: UserProfileStateModel = {
  isLoading: false,
  profile: null,
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
}
