import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { ActivatedRoute } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { UserProfileFetchIntegrationConfigs } from '@user-profile/state/user-profile.action';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { StravaIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';
import { UserProfileApi } from '@user-profile/api/user-profile.api';
import {
  OAuthConnectionError,
  OAuthPopupBlockedError,
  OAuthPopupService,
} from '@shared/lib/oauth-popup/oauth-popup.service';
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
  private readonly _oauthPopup = inject(OAuthPopupService);
  private readonly _destroyRef = inject(DestroyRef);

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
    if (
      this._oauthPopup.handleCallbackIfInPopup(
        this._route.snapshot.queryParamMap,
        'strava_connected',
        'strava_error',
        'strava_oauth',
      )
    ) return;
  }

  protected connect(): void {
    this.$isConnecting.set(true);

    this._api
      .getStravaConnectUrl()
      .pipe(
        finalize(() => this.$isConnecting.set(false)),
        switchMap(({ authUrl }) => this._oauthPopup.open(authUrl, 'strava_oauth')),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: () => this._store.dispatch(new UserProfileFetchIntegrationConfigs()),
        error: (err) => {
          if (err instanceof OAuthPopupBlockedError) {
            this._messageService.add({
              severity: 'warn',
              summary: 'Popup blocked',
              detail: 'Please allow popups for this site and try again.',
              life: 5000,
            });
          } else if (err instanceof OAuthConnectionError) {
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to connect Strava. Please try again.',
              life: 4000,
            });
          } else {
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to initiate Strava connection.',
              life: 3000,
            });
          }
        },
      });
  }
}
