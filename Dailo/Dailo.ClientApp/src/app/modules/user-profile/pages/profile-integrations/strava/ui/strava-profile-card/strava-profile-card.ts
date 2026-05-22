import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { StravaIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';

@Component({
  selector: 'app-strava-profile-card',
  imports: [],
  templateUrl: './strava-profile-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StravaProfileCard {
  private readonly _store = inject(Store);

  protected readonly $athlete = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) => {
      const summary = state.userProfile.integrationSummaries?.find(
        (s): s is StravaIntegrationSummary => s.type === 'strava',
      );
      return summary?.athlete ?? null;
    },
  );
}
