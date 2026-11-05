import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '@layout/services/theme.service';

interface ThemeOption {
  value: boolean;
  icon: string;
  label: string;
}

/**
 * Light / Dark switch, matching Figma component `3:18`: a white pill with two
 * round options, the active one filled ink. Built as an ARIA radio group
 * (arrow keys switch, like native radios); wraps ThemeService.
 */
@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  private readonly _themeService = inject(ThemeService);

  protected readonly $isDark = this._themeService.$isDarkMode;

  protected readonly options: ThemeOption[] = [
    { value: false, icon: 'pi pi-sun', label: 'Light' },
    { value: true, icon: 'pi pi-moon', label: 'Dark' },
  ];

  public select(isDark: boolean): void {
    if (isDark !== this.$isDark()) {
      this._themeService.toggle();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      this.select(!this.$isDark());
      const group = event.currentTarget as HTMLElement;
      queueMicrotask(() =>
        group.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(),
      );
    }
  }
}
