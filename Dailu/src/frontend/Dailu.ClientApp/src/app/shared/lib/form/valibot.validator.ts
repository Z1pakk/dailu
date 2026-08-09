import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { BaseIssue, BaseSchema, safeParse } from 'valibot';

export function valibotValidator(
  schema: BaseSchema<unknown, unknown, BaseIssue<unknown>>,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const result = safeParse(schema, control.value);
    if (result.success) {
      return null;
    }

    return {
      issue: result.issues[0].message,
      issues: result.issues.map((issue) => issue.message),
    };
  };
}

export function valibotCrossFieldValidator(
  siblingField: string,
  schemaFactory: (
    siblingValue: unknown,
  ) => BaseSchema<unknown, unknown, BaseIssue<unknown>>,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const siblingValue = control.parent?.get(siblingField)?.value;
    const result = safeParse(schemaFactory(siblingValue), control.value);
    if (result.success) {
      return null;
    }
    return {
      issue: result.issues[0].message,
      issues: result.issues.map((issue) => issue.message),
    };
  };
}
