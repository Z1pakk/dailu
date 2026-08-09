import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';
import { notBlank } from '@shared/lib/form/not-blank';

export const ProfileFirstNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('First name is required'),
  notBlank(),
  v.maxLength(100, 'Maximum of 100 characters'),
);

export const ProfileLastNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Last name is required'),
  notBlank(),
  v.maxLength(100, 'Maximum of 100 characters'),
);

export const ProfileMainFormSchema = v.object({
  firstName: ProfileFirstNameSchema,
  lastName: ProfileLastNameSchema,
});

export type ProfileMainFormValue = v.InferOutput<typeof ProfileMainFormSchema>;

export type ProfileMainForm = {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
};

export type ProfileMainFormGroup = FormGroup<ProfileMainForm>;
