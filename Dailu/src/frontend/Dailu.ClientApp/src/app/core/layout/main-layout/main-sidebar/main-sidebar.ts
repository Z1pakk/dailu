import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MainMenu } from '@layout/main-layout/main-menu/main-menu';
import { RouterLink } from '@angular/router';
import { RingLogo } from '@shared/ui/ring-logo/ring-logo';

@Component({
  selector: 'app-main-sidebar',
  imports: [MainMenu, RouterLink, RingLogo],
  templateUrl: './main-sidebar.html',
  styleUrl: './main-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainSidebar {}
