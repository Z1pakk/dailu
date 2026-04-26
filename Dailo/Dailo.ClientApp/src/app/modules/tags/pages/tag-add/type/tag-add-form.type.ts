import * as v from 'valibot';
import { FormControl, FormGroup } from '@angular/forms';

export const TagNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Name is required'),
  v.maxLength(100, 'Maximum of 100 characters'),
);

export const TagDescriptionSchema = v.pipe(
  v.string(),
  v.maxLength(500, 'Maximum of 500 characters'),
);

export const TagAddFormSchema = v.object({
  name: TagNameSchema,
  description: TagDescriptionSchema,
});

export type TagAddFormValue = v.InferOutput<typeof TagAddFormSchema>;

export type TagAddForm = {
  name: FormControl<string>;
  description: FormControl<string>;
};

export type TagAddFormGroup = FormGroup<TagAddForm>;
