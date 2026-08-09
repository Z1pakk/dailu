import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideStore } from '@ngxs/store';
import { environment } from '@environment';
import { providePrimeNG } from 'primeng/config';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { credentialsInterceptor } from '@auth/interceptors/credentials.interceptor';
import { authInterceptor } from '@auth/interceptors/auth.interceptor';
import { jwtInterceptor } from '@auth/interceptors/jwt.interceptor';
import { problemDetailsInterceptor } from '@shared/lib/api/interceptors/problem-details.interceptor';
import { DefaultPreset } from './default-preset';
import { provideInitialAuth } from '@auth/providers/provide-initial-auth.provider';
import { states } from '@main/state';
import { provideDefaultDataTimeFormat } from '@main/providers/date-time.provider';
import { providePrimeNgServices } from '@main/providers/prime-ng-services.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([
        credentialsInterceptor,
        jwtInterceptor,
        problemDetailsInterceptor,
        authInterceptor,
      ]),
    ),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideStore(states, {
      developmentMode: !environment.isProduction,
    }),
    providePrimeNG({
      theme: {
        preset: DefaultPreset,
        options: {
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
          darkModeSelector: '.app-dark',
        },
      },
    }),
    provideInitialAuth(),
    provideDefaultDataTimeFormat(),
    providePrimeNgServices(),
  ],
};
