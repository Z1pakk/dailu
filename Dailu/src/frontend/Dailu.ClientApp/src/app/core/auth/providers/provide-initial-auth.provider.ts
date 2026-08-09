import { inject, provideAppInitializer } from '@angular/core';
import { Store } from '@ngxs/store';
import { AuthRefresh } from '@auth/state/auth.action';
import { catchError, EMPTY } from 'rxjs';

export const provideInitialAuth = () =>
  provideAppInitializer(() => {
    const store = inject(Store);

    return store.dispatch(new AuthRefresh()).pipe(catchError((err) => EMPTY));
  });
