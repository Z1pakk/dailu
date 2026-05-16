import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, EMPTY, finalize, tap } from 'rxjs';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import {
  UserProfileRevokeIntegrationConfig,
  UserProfileSaveIntegrationConfig,
} from '@user-profile/state/user-profile.action';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { StravaIntegrationConfig } from '@user-profile/models/integration-config.model';
import { StravaIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';
import {
  StravaClientIdSchema,
  StravaClientSecretSchema,
  StravaIntegrationForm,
  StravaIntegrationFormGroup,
  StravaIntegrationFormValue,
} from './profile-strava-integration-form.type';

@Component({
  selector: 'app-profile-strava-integration',
  imports: [Button, InputText, ReactiveFormsModule],
  templateUrl: './profile-strava-integration.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileStravaIntegration {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);

  protected readonly $isEditing = signal(false);
  protected readonly $isRevoking = signal(false);

  protected readonly $isSaving = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.isSavingIntegration,
  );

  protected readonly $isLoading = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.isLoadingIntegrations,
  );

  protected readonly $stravaSummary = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      state.userProfile.integrationSummaries?.find(
        (s): s is StravaIntegrationSummary => s.type === 'strava',
      ),
  );

  protected readonly $showConnected = computed(
    () => !!this.$stravaSummary() && !this.$isEditing(),
  );

  protected readonly $showForm = computed(
    () => !this.$stravaSummary() || this.$isEditing(),
  );

  protected readonly form: StravaIntegrationFormGroup =
    this._fb.group<StravaIntegrationForm>({
      clientId: this._fb.control<string>(
        '',
        valibotValidator(StravaClientIdSchema),
      ),
      clientSecret: this._fb.control<string>(
        '',
        valibotValidator(StravaClientSecretSchema),
      ),
    });

  protected startEditing(): void {
    this.form.reset();
    this.$isEditing.set(true);
  }

  protected save() {
    this.form.markAllAsTouched();
    this.form.markAsDirty();

    if (this.form.invalid) return;

    const { clientId, clientSecret }: StravaIntegrationFormValue =
      this.form.getRawValue();

    this._store
      .dispatch(
        new UserProfileSaveIntegrationConfig((<StravaIntegrationConfig>{
          type: 'strava',
          clientId,
          clientSecret,
        }) satisfies StravaIntegrationConfig),
      )
      .pipe(
        tap({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Strava integration saved successfully.',
              life: 3000,
            });
            this.form.reset();
            this.$isEditing.set(false);
          },
        }),
        catchError((error: HttpErrorResponse) => {
          applyServerErrors(this.form, error);
          return EMPTY;
        }),
      )
      .subscribe();
  }

  protected cancel(): void {
    this.form.reset();
    this.$isEditing.set(false);
  }

  protected revoke(): void {
    this.$isRevoking.set(true);
    this._store
      .dispatch(new UserProfileRevokeIntegrationConfig('strava'))
      .pipe(
        tap({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Strava integration revoked.',
              life: 3000,
            });
          },
        }),
        catchError(() => {
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to revoke Strava integration.',
            life: 3000,
          });
          return EMPTY;
        }),
        finalize(() => this.$isRevoking.set(false)),
      )
      .subscribe();
  }
}
