import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, EMPTY, tap } from 'rxjs';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import { UserProfileSaveIntegrationConfig } from '@user-profile/state/user-profile.action';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { GithubIntegrationConfig } from '@user-profile/models/integration-config.model';
import { UserProfileStateModel } from '@user-profile/state/user-profile.state';
import {
  GithubAccessTokenSchema,
  GithubExpiresInDaysSchema,
  GithubIntegrationForm,
  GithubIntegrationFormGroup,
  GithubIntegrationFormValue,
} from '../../profile-github-integration-form.type';

@Component({
  selector: 'app-github-token-form',
  imports: [ReactiveFormsModule, InputText, InputNumber, Button],
  templateUrl: './github-token-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubTokenForm {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly $isSaving = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.isSavingIntegration,
  );

  protected readonly $showCancel = this._store.selectSignal(
    (state: { userProfile: UserProfileStateModel }) =>
      !!state.userProfile.integrationSummaries?.some((s) => s.type === 'github'),
  );

  protected readonly form: GithubIntegrationFormGroup =
    this._fb.group<GithubIntegrationForm>({
      accessToken: this._fb.control<string>('', valibotValidator(GithubAccessTokenSchema)),
      expiresInDays: this._fb.control<number | null>(
        null,
        valibotValidator(GithubExpiresInDaysSchema),
      ),
    });

  protected save(): void {
    this.form.markAllAsTouched();
    this.form.markAsDirty();

    if (this.form.invalid) return;

    const { accessToken, expiresInDays }: GithubIntegrationFormValue = this.form.getRawValue();

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
            this.saved.emit();
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
    this.cancelled.emit();
  }
}
