import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LogoWidget } from '@shared/ui/logo-widget/logo-widget';
import { ThemeService } from '@layout/services/theme.service';

@Component({
  selector: 'app-main-footer',
  imports: [LogoWidget],
  templateUrl: './main-footer.html',
  styleUrl: './main-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainFooter {
  private readonly _themeService = inject(ThemeService);

  protected readonly currentYear = new Date().getFullYear();
  protected readonly $isDarkMode = this._themeService.$isDarkMode;
}
