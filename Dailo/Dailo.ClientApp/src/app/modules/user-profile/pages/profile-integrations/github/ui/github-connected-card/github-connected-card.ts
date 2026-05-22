import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { differenceInDays, format, startOfDay } from 'date-fns';
import { Store } from '@ngxs/store';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { catchError, EMPTY, finalize, tap } from 'rxjs';
import { UserProfileRevokeIntegrationConfig } from '@user-profile/state/user-profile.action';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { GithubIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';

@Component({
  selector: 'app-github-connected-card',
  imports: [Button, ConfirmPopup, Tooltip],
  templateUrl: './github-connected-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubConnectedCard {
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly updateClicked = output<void>();

  protected readonly $isRevoking = signal(false);

  protected readonly $isSaving = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.isSavingIntegration,
  );

  protected readonly $githubSummary = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      state.userProfile.integrationSummaries?.find(
        (s): s is GithubIntegrationSummary => s.type === 'github',
      ),
  );

  protected readonly $expiryInfo = computed(() => {
    const summary = this.$githubSummary();
    if (!summary) return null;

    if (summary.expiresAtUtc === null) {
      return {
        text: 'Never expires',
        cssClass: 'text-surface-500 dark:text-surface-400',
        tooltip: null,
      };
    }

    const expiresAt = new Date(summary.expiresAtUtc);
    const tooltip = format(expiresAt, 'dd MMM yyyy, HH:mm');

    const daysRemaining = differenceInDays(
      startOfDay(expiresAt),
      startOfDay(new Date()),
    );

    if (daysRemaining < 0) {
      return {
        text: `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago`,
        cssClass: 'text-red-500 dark:text-red-400',
        tooltip,
      };
    }
    if (daysRemaining === 0) {
      return {
        text: 'Expires today',
        cssClass: 'text-orange-500 dark:text-orange-400',
        tooltip,
      };
    }
    if (daysRemaining <= 14) {
      return {
        text: `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
        cssClass: 'text-orange-500 dark:text-orange-400',
        tooltip,
      };
    }
    return {
      text: `Expires in ${daysRemaining} days`,
      cssClass: 'text-surface-500 dark:text-surface-400',
      tooltip,
    };
  });

  protected revoke(event: MouseEvent): void {
    this._confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Are you sure you want to revoke the GitHub integration?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Revoke',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.$isRevoking.set(true);
        this._store
          .dispatch(new UserProfileRevokeIntegrationConfig('github'))
          .pipe(
            tap({
              next: () => {
                this._messageService.add({
                  severity: 'success',
                  summary: 'Success',
                  detail: 'GitHub integration revoked.',
                  life: 3000,
                });
              },
            }),
            catchError(() => {
              this._messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to revoke GitHub integration.',
                life: 3000,
              });
              return EMPTY;
            }),
            finalize(() => this.$isRevoking.set(false)),
          )
          .subscribe();
      },
    });
  }
}
