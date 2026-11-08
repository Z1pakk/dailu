import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Avatar } from 'primeng/avatar';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { RingLogo } from '@shared/ui/ring-logo/ring-logo';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';
import { AVATAR_TOKENS, injectCurrentUser, MAIN_NAV } from '../main-nav';

/** Desktop sidebar (Figma `54:2293`). */
@Component({
  selector: 'app-main-sidebar',
  imports: [RouterLink, RouterLinkActive, Avatar, Menu, Tooltip, RingLogo, ThemeToggle],
  templateUrl: './main-sidebar.html',
  styleUrl: './main-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainSidebar {
  protected readonly nav = MAIN_NAV;
  protected readonly user = injectCurrentUser();
  protected readonly avatarTokens = AVATAR_TOKENS;
}
