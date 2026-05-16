import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngxs/store';
import { GithubIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';
import { GithubConnectedCard } from './ui/github-connected-card/github-connected-card';
import { GithubProfileCard } from './ui/github-profile-card/github-profile-card';
import { GithubTokenForm } from './ui/github-token-form/github-token-form';

@Component({
  selector: 'app-profile-github-integration',
  imports: [GithubConnectedCard, GithubProfileCard, GithubTokenForm],
  templateUrl: './profile-github-integration.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileGithubIntegration {
  private readonly _store = inject(Store);

  protected readonly $isLoading = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.isLoadingIntegrations,
  );

  protected readonly $githubSummary = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      state.userProfile.integrationSummaries?.find(
        (s): s is GithubIntegrationSummary => s.type === 'github',
      ),
  );

  protected readonly $isEditing = signal(false);

  protected readonly $showConnected = computed(
    () => !!this.$githubSummary() && !this.$isEditing(),
  );

  protected readonly $showForm = computed(
    () => !this.$githubSummary() || this.$isEditing(),
  );

  protected startEditing(): void {
    this.$isEditing.set(true);
  }

  protected stopEditing(): void {
    this.$isEditing.set(false);
  }
}
