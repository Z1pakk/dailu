import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { ProblemDetailsModel } from '../models/problem-details.model';
import { SHOW_ERROR_NOTIFICATION } from '../context/http-request.context';

export const problemDetailsInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || !req.context.get(SHOW_ERROR_NOTIFICATION)) {
        return throwError(() => error);
      }

      const problemDetails = error.error as ProblemDetailsModel;

      messageService.add({
        severity: 'error',
        summary: problemDetails?.title ?? 'Error',
        detail: problemDetails?.detail ?? 'An unexpected error occurred.',
        life: 5000,
      });

      return throwError(() => error);
    }),
  );
};
