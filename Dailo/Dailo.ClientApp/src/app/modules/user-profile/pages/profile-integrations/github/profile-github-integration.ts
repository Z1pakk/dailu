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
import { GithubIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';
import { UserProfileApi } from '@user-profile/api/user-profile.api';
import {
  OAuthConnectionError,
  OAuthPopupBlockedError,
  OAuthPopupService,
} from '@shared/lib/oauth-popup/oauth-popup.service';
import { GithubConnectedCard } from './ui/github-connected-card/github-connected-card';
import { GithubProfileCard } from './ui/github-profile-card/github-profile-card';

@Component({
  selector: 'app-profile-github-integration',
  imports: [Button, GithubConnectedCard, GithubProfileCard],
  templateUrl: './profile-github-integration.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileGithubIntegration implements OnInit {
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

  protected readonly $githubSummary = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      state.userProfile.integrationSummaries?.find(
        (s): s is GithubIntegrationSummary => s.type === 'github',
      ),
  );

  protected readonly $showConnected = computed(() => !!this.$githubSummary());

  ngOnInit(): void {
    if (
      this._oauthPopup.handleCallbackIfInPopup(
        this._route.snapshot.queryParamMap,
        'github_connected',
        'github_error',
        'github_oauth',
      )
    ) return;
  }

  protected connect(): void {
    this.$isConnecting.set(true);

    this._api
      .getGithubConnectUrl()
      .pipe(
        finalize(() => this.$isConnecting.set(false)),
        switchMap(({ authUrl }) => this._oauthPopup.open(authUrl, 'github_oauth')),
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
              detail: 'Failed to connect GitHub. Please try again.',
              life: 4000,
            });
          } else {
            this._messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to initiate GitHub connection.',
              life: 3000,
            });
          }
        },
      });
  }
}
