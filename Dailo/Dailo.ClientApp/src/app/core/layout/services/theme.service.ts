import { DOCUMENT } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { LocalStorageService } from '@core/services/local-storage.service';
import { BroadcastService } from '@core/services/broadcast.service';
import { toSignal } from '@angular/core/rxjs-interop';

const THEME_KEY = 'theme';
const DARK_CLASS = 'app-dark';
const DARK_THEME_MESSAGE = 'dark';
const LIGHT_THEME_MESSAGE = 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _document = inject(DOCUMENT);
  private readonly _localStorageService = inject(LocalStorageService);
  private readonly _broadcastService = inject(BroadcastService);

  private readonly _$isDarkMode = signal(
    this._localStorageService.get(THEME_KEY) === DARK_THEME_MESSAGE || false,
  );

  private readonly _$themeBroadcast = toSignal(
    this._broadcastService.messages$(THEME_KEY),
  );
  private readonly _$themeMessageKey = computed(() => {
    return this._$isDarkMode() ? DARK_THEME_MESSAGE : LIGHT_THEME_MESSAGE;
  });

  public readonly $isDarkMode = this._$isDarkMode.asReadonly();

  constructor() {
    effect(() => {
      const themeBroadcast = this._$themeBroadcast();

      untracked(() =>
        this._$isDarkMode.set(themeBroadcast === DARK_THEME_MESSAGE),
      );
    });

    effect(() => {
      this.apply(this._$isDarkMode());

      this._localStorageService.set(THEME_KEY, this._$themeMessageKey());
    });
  }

  public toggle(): void {
    this._$isDarkMode.update((isDarkMode) => !isDarkMode);

    this._broadcastService.post(THEME_KEY, this._$themeMessageKey());
  }

  private apply(isDark: boolean): void {
    this._document.documentElement.classList.toggle(DARK_CLASS, isDark);
  }
}
