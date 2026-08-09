import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MainMenu } from '@layout/main-layout/main-menu/main-menu';
import { RouterLink } from '@angular/router';
import { LogoWidget } from '@shared/ui/logo-widget/logo-widget';

@Component({
  selector: 'app-main-sidebar',
  imports: [MainMenu, RouterLink, LogoWidget, MainMenu],
  templateUrl: './main-sidebar.html',
  styleUrl: './main-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainSidebar {}
