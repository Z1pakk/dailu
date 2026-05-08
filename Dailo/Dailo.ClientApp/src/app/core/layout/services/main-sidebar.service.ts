import { inject, Injectable, signal } from '@angular/core';
import { SessionStorageService } from '@core/services/session-storage.service';

@Injectable({ providedIn: 'root' })
export class MainSidebarService {
  private readonly _sessionStorageService = inject(SessionStorageService);

  private readonly _menuOpenedKey = 'isMenuOpened';

  private readonly _$isMenuOpened = signal<boolean>(
    this._sessionStorageService.get(this._menuOpenedKey) !== 'false',
  );

  public readonly $isMenuOpened = this._$isMenuOpened.asReadonly();

  public toggleMenu() {
    this._$isMenuOpened.update((isOpened) => !isOpened);

    this._sessionStorageService.set(
      this._menuOpenedKey,
      this._$isMenuOpened().toString(),
    );
  }
}
