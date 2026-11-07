import 'altcha';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Password } from 'primeng/password';
import { Checkbox } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { RouterLink } from '@angular/router';
import { Message } from 'primeng/message';
import { DayClock } from '@shared/ui/day-clock/day-clock';
import { AuthShell } from '@auth/ui/auth-shell/auth-shell';
import { EXAMPLE_DAY } from '../../../../modules/landing/data/example-day';
import { loginPanelDate } from './login-panel-date';
import { Store } from '@ngxs/store';
import { valibotValidator } from '@shared/lib/form/valibot.validator';
import {
  LoginEmailSchema,
  LoginForm,
  LoginFormGroup,
  LoginFormValue,
  LoginPasswordSchema,
} from './types/login-form.type';
import { AuthLogin } from '@auth/state/auth.action';
import { LoginRequest } from '@auth/requests/login.request';
import { AuthRouterService } from '@auth/services/auth-router.service';
import { AltchaService } from '@auth/services/altcha.service';
import { markAllAsDirty } from '@shared/lib/form/mark-as-dirty';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  imports: [
    Checkbox,
    Button,
    ReactiveFormsModule,
    InputText,
    RouterLink,
    Password,
    Message,
    DayClock,
    AuthShell,
  ],
  providers: [AltchaService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly _store = inject(Store);
  private readonly _authRouterService = inject(AuthRouterService);
  private readonly _fb = inject(NonNullableFormBuilder);
  protected readonly altchaService = inject(AltchaService);

  protected readonly $loginError = signal<string | null>(null);
  /** 401: outline the password field as well as showing the banner (Figma `42:2450`). */
  protected readonly $isCredentialsRejected = signal(false);

  protected readonly panelDate = loginPanelDate(new Date());
  protected readonly panelHeadline = ['Your dial is waiting.', '4 of 6 already checked.'];
  protected readonly exampleDay = EXAMPLE_DAY;
  protected readonly errorMessageTokens = {
    error: {
      background: 'var(--dl-danger-tint)',
      borderColor: 'var(--dl-danger-border)',
      color: 'var(--dl-danger-text)',
      shadow: 'none',
    },
  };

  private readonly _$altchaWidgetRef = viewChild<ElementRef>('altchaWidget');

  constructor() {
    effect(() => {
      if (this.altchaService.$isError()) {
        this.$loginError.set('A network error occurred. Please try again later.');
      }
    });
  }

  protected readonly loginForm: LoginFormGroup = this._fb.group<LoginForm>({
    email: this._fb.control<string>('', {
      validators: valibotValidator(LoginEmailSchema),
      updateOn: 'blur',
    }),
    password: this._fb.control('', valibotValidator(LoginPasswordSchema)),
    isRememberMe: this._fb.control(false),
  });

  protected emailInput(event: Event) {
    const control = this.loginForm.controls.email;
    if (control.touched) {
      control.setValue((event.target as HTMLInputElement).value);
    }
  }

  protected login() {
    this.$loginError.set(null);
    this.$isCredentialsRejected.set(false);
    markAllAsDirty(this.loginForm);

    if (!this.altchaService.$isSolved() || !this.loginForm.valid) {
      return;
    }

    const value: LoginFormValue = this.loginForm.getRawValue();

    const loginRequest = (<LoginRequest>{
      email: value.email,
      password: value.password,
      captchaPayload: this.altchaService.$captchaPayload()!,
    }) satisfies LoginRequest;

    this._store.dispatch(new AuthLogin(loginRequest)).subscribe({
      next: () => {
        this._authRouterService.goToMainAppPage();
      },
      error: (error: HttpErrorResponse) => {
        this._resetCaptcha();
        if (error.status === 401) {
          this.$isCredentialsRejected.set(true);
          this.$loginError.set('Invalid email or password.');
        } else if (error.status === 0 || error.status >= 500) {
          this.$loginError.set('An error occurred. Please try again later.');
        } else {
          this.$loginError.set(error.error?.detail ?? 'An error occurred. Please try again later.');
        }
      },
    });
  }

  private _resetCaptcha(): void {
    const widget = this._$altchaWidgetRef()?.nativeElement;
    widget?.reset();
    widget?.verify();
  }
}
