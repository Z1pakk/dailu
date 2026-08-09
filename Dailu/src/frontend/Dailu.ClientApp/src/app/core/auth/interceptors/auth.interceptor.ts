import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { AuthRefresh } from '@auth/state/auth.action';
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/auth/refresh')) {
    return next(req);
  }

  if (req.url.includes('/auth/login')) {
    return next(req);
  }

  const store = inject(Store);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      return store.dispatch(new AuthRefresh()).pipe(
        switchMap(() => next(req)),
        catchError(() => {
          router.navigate(['/login']);
          return throwError(() => error);
        }),
      );
    }),
  );
};
