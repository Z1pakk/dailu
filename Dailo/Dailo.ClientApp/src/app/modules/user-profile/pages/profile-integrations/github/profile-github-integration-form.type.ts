import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';
import { notBlank } from '@shared/lib/form/not-blank';

export const GithubAccessTokenSchema = v.pipe(
  v.string(),
  v.nonEmpty('Access token is required'),
  notBlank(),
  v.maxLength(255, 'Maximum of 255 characters'),
);

export const GithubExpiresInDaysSchema = v.nullable(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1, 'Must be at least 1 day'),
    v.maxValue(365, 'Must not exceed 365 days'),
  ),
);

export const GithubIntegrationFormSchema = v.object({
  accessToken: GithubAccessTokenSchema,
  expiresInDays: GithubExpiresInDaysSchema,
});

export type GithubIntegrationFormValue = v.InferOutput<typeof GithubIntegrationFormSchema>;

export type GithubIntegrationForm = {
  accessToken: FormControl<string>;
  expiresInDays: FormControl<number | null>;
};

export type GithubIntegrationFormGroup = FormGroup<GithubIntegrationForm>;
