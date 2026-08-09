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
import { GoogleHealthIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';
import { UserProfileApi } from '@user-profile/api/user-profile.api';
import {
  OAuthConnectionError,
  OAuthPopupBlockedError,
  OAuthPopupService,
} from '@shared/lib/oauth-popup/oauth-popup.service';
import { GoogleHealthConnectedCard } from './ui/google-health-connected-card/google-health-connected-card';
import { GoogleHealthProfileCard } from './ui/google-health-profile-card/google-health-profile-card';

@Component({
  selector: 'app-profile-google-health-integration',
  imports: [Button, GoogleHealthConnectedCard, GoogleHealthProfileCard],
  templateUrl: './profile-google-health-integration.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileGoogleHealthIntegration implements OnInit {
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

  protected readonly $googleHealthSummary = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      state.userProfile.integrationSummaries?.find(
        (s): s is GoogleHealthIntegrationSummary => s.type === 'google-health',
      ),
  );

  protected readonly $showConnected = computed(
    () => !!this.$googleHealthSummary(),
  );

  ngOnInit(): void {
    if (
      this._oauthPopup.handleCallbackIfInPopup(
        this._route.snapshot.queryParamMap,
        'google_health_connected',
        'google_health_error',
        'google_health_oauth',
      )
    )
      return;
  }

  protected connect(): void {
    this.$isConnecting.set(true);

    this._api
      .getGoogleHealthConnectUrl()
      .pipe(
        finalize(() => this.$isConnecting.set(false)),
        switchMap(({ authUrl }) =>
          this._oauthPopup.open(authUrl, 'google_health_oauth'),
        ),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: () =>
          this._store.dispatch(new UserProfileFetchIntegrationConfigs()),
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
              detail: 'Failed to connect Google Health. Please try again.',
              life: 4000,
            });
          } else {
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to initiate Google Health connection.',
              life: 3000,
            });
          }
        },
      });
  }
}
