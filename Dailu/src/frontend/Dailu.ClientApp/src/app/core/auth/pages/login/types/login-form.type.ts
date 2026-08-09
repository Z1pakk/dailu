import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';

export const LoginEmailSchema = v.pipe(
  v.string(),
  v.nonEmpty('Email is required'),
  v.email('Email is incorrect'),
);

export const LoginPasswordSchema = v.pipe(
  v.string(),
  v.nonEmpty('Password is required'),
  v.minLength(6, 'Minimum of 6 characters long'),
  v.maxLength(100, 'Maximum of 100 characters long'),
);

export const LoginFormSchema = v.object({
  email: LoginEmailSchema,
  password: LoginPasswordSchema,
  isRememberMe: v.boolean(),
});

export type LoginFormValue = v.InferOutput<typeof LoginFormSchema>;

export type LoginFormGroup = FormGroup<LoginForm>;

export type LoginForm = {
  email: FormControl<string>;
  password: FormControl<string>;
  isRememberMe: FormControl<boolean>;
};
