import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, EMPTY, tap } from 'rxjs';
import { LocalStorageService } from '@core/services/local-storage.service';
import { StreakChip } from '@habits/ui/streak-chip/streak-chip';
import { CoachButton } from '@shared/ui/coach-button/coach-button';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import { applyServerErrors } from '@shared/lib/form/apply-server-errors';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';
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

type WeekStart = 'monday' | 'sunday';
type TimeFormat = '12-hour' | '24-hour';

const WEEK_START_KEY = 'profile-week-start';
const TIME_FORMAT_KEY = 'profile-time-format';

@Component({
  selector: 'app-profile-main',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Avatar,
    Button,
    InputText,
    Password,
    ToggleSwitch,
    Tooltip,
    StreakChip,
    CoachButton,
    ThemeToggle,
  ],
  templateUrl: './profile-main.html',
  styleUrl: './profile-main.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMain implements OnInit {
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _store = inject(Store);
  private readonly _messageService = inject(MessageService);
  private readonly _localStorageService = inject(LocalStorageService);

  protected readonly $profile = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.profile,
  );

  protected readonly $isLoading = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.isLoading,
  );

  protected readonly $displayName = computed(() => {
    const profile = this.$profile();
    return [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Your profile';
  });

  protected readonly $avatarLabel = computed(() => {
    const profile = this.$profile();
    const initials = `${profile?.firstName?.charAt(0) ?? ''}${profile?.lastName?.charAt(0) ?? ''}`;
    return initials.toUpperCase() || 'DL';
  });

  protected readonly $weekStart = signal<WeekStart>(
    this._localStorageService.get(WEEK_START_KEY) === 'sunday' ? 'sunday' : 'monday',
  );

  protected readonly $timeFormat = signal<TimeFormat>(
    this._localStorageService.get(TIME_FORMAT_KEY) === '12-hour' ? '12-hour' : '24-hour',
  );

  /** Figma profile switches use ink, not primary teal. */
  protected readonly switchTokens = {
    root: {
      checkedBackground: 'var(--dl-bg-inverse)',
      checkedHoverBackground: 'var(--dl-bg-inverse)',
      disabledBackground: 'var(--dl-bg-inverse)',
    },
    handle: {
      checkedBackground: 'var(--dl-text-inverse)',
      checkedHoverBackground: 'var(--dl-text-inverse)',
      disabledBackground: 'var(--dl-text-inverse)',
    },
  };

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

  protected setWeekStart(value: WeekStart): void {
    this.$weekStart.set(value);
    this._localStorageService.set(WEEK_START_KEY, value);
  }

  protected setTimeFormat(value: TimeFormat): void {
    this.$timeFormat.set(value);
    this._localStorageService.set(TIME_FORMAT_KEY, value);
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
