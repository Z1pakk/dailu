import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';
import { notBlank } from '@shared/lib/form/not-blank';

export const StravaAccessTokenSchema = v.pipe(
  v.string(),
  v.nonEmpty('Access token is required'),
  notBlank(),
  v.maxLength(255, 'Maximum of 255 characters'),
);

export const StravaRefreshTokenSchema = v.pipe(
  v.string(),
  v.nonEmpty('Refresh token is required'),
  notBlank(),
  v.maxLength(255, 'Maximum of 255 characters'),
);

export const StravaExpiresInHoursSchema = v.nullable(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1, 'Must be at least 1 hour'),
    v.maxValue(24, 'Must not exceed 24 hours'),
  ),
);

export const StravaIntegrationFormSchema = v.object({
  accessToken: StravaAccessTokenSchema,
  refreshToken: StravaRefreshTokenSchema,
  expiresInHours: StravaExpiresInHoursSchema,
});

export type StravaIntegrationFormValue = v.InferOutput<typeof StravaIntegrationFormSchema>;

export type StravaIntegrationForm = {
  accessToken: FormControl<string>;
  refreshToken: FormControl<string>;
  expiresInHours: FormControl<number | null>;
};

export type StravaIntegrationFormGroup = FormGroup<StravaIntegrationForm>;
