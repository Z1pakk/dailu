import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthRouterService {
  private readonly _router = inject(Router);

  public goToMainAppPage() {
    return this._router.navigate(['/app']);
  }

  public goToLoginPage() {
    return this._router.navigate(['/login']);
  }
}
