import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { AuthStateSelectors } from '@auth/state/auth.selector';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(Store).selectSnapshot(AuthStateSelectors.getSlices.authToken);

  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
