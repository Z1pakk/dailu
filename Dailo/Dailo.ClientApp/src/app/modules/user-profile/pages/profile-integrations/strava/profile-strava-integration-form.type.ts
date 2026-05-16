import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';
import { notBlank } from '@shared/lib/form/not-blank';

export const StravaClientIdSchema = v.pipe(
  v.string(),
  v.nonEmpty('Client ID is required'),
  notBlank(),
  v.maxLength(100, 'Maximum of 100 characters'),
);

export const StravaClientSecretSchema = v.pipe(
  v.string(),
  v.nonEmpty('Client secret is required'),
  notBlank(),
  v.maxLength(255, 'Maximum of 255 characters'),
);

export const StravaIntegrationFormSchema = v.object({
  clientId: StravaClientIdSchema,
  clientSecret: StravaClientSecretSchema,
});

export type StravaIntegrationFormValue = v.InferOutput<typeof StravaIntegrationFormSchema>;

export type StravaIntegrationForm = {
  clientId: FormControl<string>;
  clientSecret: FormControl<string>;
};

export type StravaIntegrationFormGroup = FormGroup<StravaIntegrationForm>;
