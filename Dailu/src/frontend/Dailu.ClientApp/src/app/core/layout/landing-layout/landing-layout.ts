import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LandingTopbar } from '@layout/landing-layout/landing-topbar/landing-topbar';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';

@Component({
  selector: 'app-landing-layout',
  imports: [RouterOutlet, RouterLink, LandingTopbar, ThemeToggle],
  templateUrl: './landing-layout.html',
  styleUrl: './landing-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingLayout {
  protected readonly year = new Date().getFullYear();
}
