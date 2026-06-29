import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserProfileGetGoogleHealthProfile } from '@user-profile/state/user-profile.action';
import { GoogleHealthIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';

@Component({
  selector: 'app-google-health-profile-card',
  imports: [],
  templateUrl: './google-health-profile-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleHealthProfileCard {
  private readonly _store = inject(Store);

  protected readonly $profile = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) => state.userProfile.googleHealthProfile,
  );

  protected readonly $isLoading = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) => state.userProfile.isLoadingGoogleHealthProfile,
  );

  protected readonly $hasError = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) => state.userProfile.googleHealthProfileError,
  );

  private readonly $googleHealthSummary = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      state.userProfile.integrationSummaries?.find(
        (s): s is GoogleHealthIntegrationSummary => s.type === 'google-health',
      ),
  );

  constructor() {
    effect(() => {
      if (this.$googleHealthSummary()) {
        this._store.dispatch(new UserProfileGetGoogleHealthProfile());
      }
    });
  }
}
