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
import { InputNumber } from 'primeng/inputnumber';
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
import { GithubIntegrationConfig } from '@user-profile/models/integration-config.model';
import { GithubIntegrationSummary } from '@user-profile/models/integration-summary.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';
import {
  GithubAccessTokenSchema,
  GithubExpiresInDaysSchema,
  GithubIntegrationForm,
  GithubIntegrationFormGroup,
  GithubIntegrationFormValue,
} from './profile-github-integration-form.type';

@Component({
  selector: 'app-profile-github-integration',
  imports: [Button, InputText, InputNumber, ReactiveFormsModule],
  templateUrl: './profile-github-integration.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileGithubIntegration {
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

  protected readonly $githubSummary = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      state.userProfile.integrationSummaries?.find(
        (s): s is GithubIntegrationSummary => s.type === 'github',
      ),
  );

  protected readonly $showConnected = computed(
    () => !!this.$githubSummary() && !this.$isEditing(),
  );

  protected readonly $showForm = computed(
    () => !this.$githubSummary() || this.$isEditing(),
  );

  protected readonly $expiryInfo = computed(() => {
    const summary = this.$githubSummary();
    if (!summary) return null;

    if (summary.expiresAt === null) {
      return { text: 'Never expires', cssClass: 'text-surface-500 dark:text-surface-400' };
    }

    const daysRemaining = Math.floor(
      (new Date(summary.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (daysRemaining < 0) {
      return {
        text: `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago`,
        cssClass: 'text-red-500 dark:text-red-400',
      };
    }
    if (daysRemaining === 0) {
      return { text: 'Expires today', cssClass: 'text-orange-500 dark:text-orange-400' };
    }
    if (daysRemaining <= 14) {
      return {
        text: `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
        cssClass: 'text-orange-500 dark:text-orange-400',
      };
    }
    return {
      text: `Expires in ${daysRemaining} days`,
      cssClass: 'text-surface-500 dark:text-surface-400',
    };
  });

  protected readonly form: GithubIntegrationFormGroup =
    this._fb.group<GithubIntegrationForm>({
      accessToken: this._fb.control<string>(
        '',
        valibotValidator(GithubAccessTokenSchema),
      ),
      expiresInDays: this._fb.control<number | null>(
        null,
        valibotValidator(GithubExpiresInDaysSchema),
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

    const { accessToken, expiresInDays }: GithubIntegrationFormValue =
      this.form.getRawValue();

    this._store
      .dispatch(
        new UserProfileSaveIntegrationConfig((<GithubIntegrationConfig>{
          type: 'github',
          accessToken,
          expiresInDays,
        }) satisfies GithubIntegrationConfig),
      )
      .pipe(
        tap({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'GitHub integration saved successfully.',
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
  }
}
