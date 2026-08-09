import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Store } from '@ngxs/store';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmPopup } from 'primeng/confirmpopup';
import { Button } from 'primeng/button';
import { catchError, EMPTY, finalize, tap } from 'rxjs';
import { UserProfileRevokeIntegrationConfig } from '@user-profile/state/user-profile.action';

@Component({
  selector: 'app-google-health-connected-card',
  imports: [Button, ConfirmPopup],
  templateUrl: './google-health-connected-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleHealthConnectedCard {
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  protected readonly $isRevoking = signal(false);

  protected revoke(event: MouseEvent): void {
    this._confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Are you sure you want to revoke the Google Health integration?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Revoke',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        this.$isRevoking.set(true);
        this._store
          .dispatch(new UserProfileRevokeIntegrationConfig('google-health'))
          .pipe(
            tap({
              next: () => {
                this._messageService.add({
                  severity: 'success',
                  summary: 'Success',
                  detail: 'Google Health integration revoked.',
                  life: 3000,
                });
              },
            }),
            catchError(() => {
              this._messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to revoke Google Health integration.',
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
