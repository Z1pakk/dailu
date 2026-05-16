import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, EMPTY, tap } from 'rxjs';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import {
  ProfileFirstNameSchema,
  ProfileLastNameSchema,
  ProfileMainForm,
  ProfileMainFormGroup,
  ProfileMainFormValue,
} from './profile-main-form.type';
import {
  UserProfileGetProfile,
  UserProfileUpdateProfile,
} from '@user-profile/state/user-profile.action';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';

@Component({
  selector: 'app-profile-main',
  imports: [Button, InputText, ReactiveFormsModule],
  templateUrl: './profile-main.html',
  styleUrl: './profile-main.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMain implements OnInit {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);

  protected readonly $profile = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.profile,
  );

  protected readonly $isLoading = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.isLoading,
  );

  protected readonly profileForm: ProfileMainFormGroup =
    this._fb.group<ProfileMainForm>({
      firstName: this._fb.control<string>(
        '',
        valibotValidator(ProfileFirstNameSchema),
      ),
      lastName: this._fb.control<string>(
        '',
        valibotValidator(ProfileLastNameSchema),
      ),
    });

  constructor() {
    effect(() => {
      const profile = this.$profile();
      if (profile) {
        this.profileForm.patchValue({
          firstName: profile.firstName,
          lastName: profile.lastName,
        });
      }
    });
  }

  ngOnInit() {
    this._store.dispatch(new UserProfileGetProfile());
  }

  protected cancelEdit() {
    const profile = this.$profile();
    if (profile) {
      this.profileForm.reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
    }
  }

  protected save() {
    this.profileForm.markAllAsTouched();
    this.profileForm.markAsDirty();

    if (this.profileForm.invalid) {
      return;
    }

    const { firstName, lastName }: ProfileMainFormValue =
      this.profileForm.getRawValue();

    this._store
      .dispatch(new UserProfileUpdateProfile({ firstName, lastName }))
      .pipe(
        tap({
          next: () => {
            this._messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Profile updated successfully.',
              life: 3000,
            });
            this.profileForm.markAsPristine();
          },
        }),
        catchError((error: HttpErrorResponse) => {
          applyServerErrors(this.profileForm, error);
          return EMPTY;
        }),
      )
      .subscribe();
  }
}
