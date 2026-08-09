import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';

export const RegisterEmailSchema = v.pipe(
  v.string(),
  v.nonEmpty('Email is required'),
  v.email('Email is incorrect'),
);

export const RegisterFirstNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('First Name is required'),
  v.maxLength(50, 'Maximum of 50 characters'),
);

export const RegisterLastNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Last Name is required'),
  v.maxLength(50, 'Maximum of 50 characters'),
);

export const RegisterPasswordSchema = v.pipe(
  v.string(),
  v.nonEmpty('Password is required'),
  v.minLength(6, 'Minimum of 6 characters long'),
  v.maxLength(100, 'Maximum of 100 characters long'),
);

export const AcceptedPrivacyTermsSchema = v.pipe(
  v.boolean(),
  v.literal(true, 'Terms and Conditions should be accepted to continue'),
);

export const RegisterConfirmPasswordSchema = (password: unknown) =>
  v.pipe(
    v.string(),
    v.nonEmpty('Confirm password is required'),
    v.minLength(6, 'Minimum of 6 characters long'),
    v.maxLength(100, 'Maximum of 100 characters long'),
    v.check((val) => val === password, 'The passwords do not match.'),
  );

export const RegisterFormSchema = v.pipe(
  v.object({
    email: RegisterEmailSchema,
    firstName: RegisterFirstNameSchema,
    lastName: RegisterLastNameSchema,
    password: RegisterPasswordSchema,
    confirmPassword: RegisterPasswordSchema,
    isAcceptedPrivacyTerms: v.boolean(),
  }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirmPassword']],
      (input) => input.password === input.confirmPassword,
      'The passwords do not match.',
    ),
    ['confirmPassword'],
  ),
);

export type RegisterFormValue = v.InferOutput<typeof RegisterFormSchema>;

export type RegisterFormGroup = FormGroup<RegisterForm>;

export type RegisterForm = {
  email: FormControl<string>;
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
  isAcceptedPrivacyTerms: FormControl<boolean>;
};
