import 'altcha';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Password } from 'primeng/password';
import { Checkbox } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { RouterLink } from '@angular/router';
import { LogoWidget } from '@shared/ui/logo-widget/logo-widget';
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
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-login',
  imports: [
    Checkbox,
    Button,
    ReactiveFormsModule,
    InputText,
    RouterLink,
    LogoWidget,
    Password,
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
  private readonly _messageService = inject(MessageService);
  protected readonly altchaService = inject(AltchaService);

  private readonly _$altchaWidgetRef = viewChild<ElementRef>('altchaWidget');

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
        this._messageService.add({
          severity: 'error',
          summary: 'Login failed',
          detail: error.error?.detail ?? 'Invalid email or password.',
          life: 5000,
        });
      },
    });
  }

  private _resetCaptcha(): void {
    const widget = this._$altchaWidgetRef()?.nativeElement;
    widget?.reset();
    widget?.verify();
  }
}
