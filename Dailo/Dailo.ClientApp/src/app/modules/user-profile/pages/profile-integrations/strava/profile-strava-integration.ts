import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { UserProfileFetchIntegrationConfigs } from '@user-profile/state/user-profile.action';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { StravaIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';
import { UserProfileApi } from '@user-profile/api/user-profile.api';
import { StravaConnectedCard } from './ui/strava-connected-card/strava-connected-card';
import { StravaProfileCard } from './ui/strava-profile-card/strava-profile-card';

@Component({
  selector: 'app-profile-strava-integration',
  imports: [Button, StravaConnectedCard, StravaProfileCard],
  templateUrl: './profile-strava-integration.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileStravaIntegration implements OnInit {
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);
  private readonly _api = inject(UserProfileApi);
  private readonly _route = inject(ActivatedRoute);

  protected readonly $isConnecting = signal(false);

  protected readonly $isLoading = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.isLoadingIntegrations,
  );

  protected readonly $stravaSummary = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      state.userProfile.integrationSummaries?.find(
        (s): s is StravaIntegrationSummary => s.type === 'strava',
      ),
  );

  protected readonly $showConnected = computed(() => !!this.$stravaSummary());

  ngOnInit(): void {
    const params = this._route.snapshot.queryParamMap;

    if (params.has('strava_connected')) {
      this._store.dispatch(new UserProfileFetchIntegrationConfigs());
    }

    if (params.has('strava_error')) {
      this._messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to connect Strava. Please try again.',
        life: 4000,
      });
    }
  }

  protected connect(): void {
    this.$isConnecting.set(true);

    this._api
      .getStravaConnectUrl()
      .pipe(finalize(() => this.$isConnecting.set(false)))
      .subscribe({
        next: ({ authUrl }) => {
          window.location.href = authUrl;
        },
        error: () => {
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to initiate Strava connection.',
            life: 3000,
          });
        },
      });
  }
}
