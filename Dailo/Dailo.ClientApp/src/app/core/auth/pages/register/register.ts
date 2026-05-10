import 'altcha';
import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  viewChild,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { LogoWidget } from '@shared/ui/logo-widget/logo-widget';
import { Password } from 'primeng/password';
import { RouterLink } from '@angular/router';
import {
  valibotCrossFieldValidator,
  valibotValidator,
} from '@shared/lib/form/valibot.validator';
import { AuthRegister } from '@auth/state/auth.action';
import { Store } from '@ngxs/store';
import { AuthRouterService } from '@auth/services/auth-router.service';
import { AltchaService } from '@auth/services/altcha.service';
import {
  AcceptedPrivacyTermsSchema,
  RegisterConfirmPasswordSchema,
  RegisterEmailSchema,
  RegisterFirstNameSchema,
  RegisterForm,
  RegisterFormGroup,
  RegisterFormValue,
  RegisterLastNameSchema,
  RegisterPasswordSchema,
} from '@auth/pages/register/types/register-form.type';
import { RegisterRequest } from '@auth/requests/register.request';
import { markAllAsDirty } from '@shared/lib/form/mark-as-dirty';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-register',
  imports: [
    Button,
    Checkbox,
    InputText,
    LogoWidget,
    Password,
    ReactiveFormsModule,
    RouterLink,
  ],
  providers: [AltchaService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register implements OnInit {
  private readonly _store = inject(Store);
  private readonly _authRouterService = inject(AuthRouterService);
  private readonly _fb = inject(NonNullableFormBuilder);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _messageService = inject(MessageService);
  protected readonly altchaService = inject(AltchaService);

  private readonly _$altchaWidgetRef = viewChild<ElementRef>('altchaWidget');

  protected readonly altcha = inject(AltchaService);

  protected readonly registerForm: RegisterFormGroup =
    this._fb.group<RegisterForm>({
      email: this._fb.control<string>('', {
        validators: valibotValidator(RegisterEmailSchema),
        updateOn: 'blur',
      }),
      firstName: this._fb.control<string>(
        '',
        valibotValidator(RegisterFirstNameSchema),
      ),
      lastName: this._fb.control<string>(
        '',
        valibotValidator(RegisterLastNameSchema),
      ),
      password: this._fb.control<string>(
        '',
        valibotValidator(RegisterPasswordSchema),
      ),
      confirmPassword: this._fb.control<string>(
        '',
        valibotCrossFieldValidator('password', RegisterConfirmPasswordSchema),
      ),
      isAcceptedPrivacyTerms: this._fb.control<boolean>(
        false,
        valibotValidator(AcceptedPrivacyTermsSchema),
      ),
    });

  ngOnInit() {
    this.registerForm.controls.password.valueChanges
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this.registerForm.controls.confirmPassword.updateValueAndValidity();
      });
  }

  protected emailInput(event: Event) {
    const control = this.registerForm.controls.email;
    if (control.touched) {
      control.setValue((event.target as HTMLInputElement).value);
    }
  }

  protected register() {
    markAllAsDirty(this.registerForm);

    if (!this.altcha.$isSolved() || !this.registerForm.valid) {
      return;
    }

    const value: RegisterFormValue = this.registerForm.getRawValue();

    const registerRequest = (<RegisterRequest>{
      email: value.email,
      firstName: value.firstName,
      lastName: value.lastName,
      password: value.password,
      confirmPassword: value.confirmPassword,
      isAcceptedPrivacyTerms: value.isAcceptedPrivacyTerms,
      captchaPayload: this.altcha.$captchaPayload()!,
    }) satisfies RegisterRequest;

    this._store.dispatch(new AuthRegister(registerRequest)).subscribe({
      next: () => {
        this._authRouterService.goToMainAppPage();
      },
      error: (error: HttpErrorResponse) => {
        this._resetCaptcha();
        this._messageService.add({
          severity: 'error',
          summary: 'Registration failed',
          detail:
            error.error?.detail ?? 'Unable to register. Please try again.',
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
