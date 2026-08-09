import { FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetailsModel } from '@shared/lib/api/models/problem-details.model';

export function applyServerErrors(form: FormGroup, error: HttpErrorResponse): void {
  const problemDetails = error.error as ProblemDetailsModel;
  if (!problemDetails?.errors) return;

  Object.entries(problemDetails.errors).forEach(([field, messages]) => {
    const controlName = field.charAt(0).toLowerCase() + field.slice(1);
    form.get(controlName)?.setErrors({ serverError: messages[0] });
  });
}
