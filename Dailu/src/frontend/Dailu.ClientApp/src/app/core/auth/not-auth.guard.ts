import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { AuthRouterService } from '@auth/services/auth-router.service';
import { AuthStateSelectors } from '@auth/state/auth.selector';

export const notAuthGuard: CanActivateFn = (route, state) => {
  const store = inject(Store);
  const router = inject(AuthRouterService);

  const $isAuthenticated = store.selectSignal(
    AuthStateSelectors.getSlices.isAuthenticated,
  );

  return $isAuthenticated() ? router.goToMainAppPage() : true;
};
