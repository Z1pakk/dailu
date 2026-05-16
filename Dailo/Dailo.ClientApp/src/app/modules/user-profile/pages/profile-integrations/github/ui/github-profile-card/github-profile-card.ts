import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserProfileGetGithubProfile } from '@user-profile/state/user-profile.action';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { GithubIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';

@Component({
  selector: 'app-github-profile-card',
  imports: [],
  templateUrl: './github-profile-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubProfileCard {
  private readonly _store = inject(Store);

  protected readonly $githubProfile = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) => state.userProfile.githubProfile,
  );

  protected readonly $isLoading = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.isLoadingGithubProfile,
  );

  protected readonly $hasError = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.githubProfileError,
  );

  private readonly $githubSummary = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      state.userProfile.integrationSummaries?.find(
        (s): s is GithubIntegrationSummary => s.type === 'github',
      ),
  );

  constructor() {
    effect(() => {
      if (this.$githubSummary()) {
        this._store.dispatch(new UserProfileGetGithubProfile());
      }
    });
  }
}
