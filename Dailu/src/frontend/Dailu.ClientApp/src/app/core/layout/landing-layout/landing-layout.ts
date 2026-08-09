import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LandingTopbar } from '@layout/landing-layout/landing-topbar/landing-topbar';
import { LogoWidget } from '@shared/ui/logo-widget/logo-widget';

@Component({
  selector: 'app-landing-layout',
  imports: [RouterOutlet, LandingTopbar, LogoWidget],
  templateUrl: './landing-layout.html',
  styleUrl: './landing-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingLayout {}
