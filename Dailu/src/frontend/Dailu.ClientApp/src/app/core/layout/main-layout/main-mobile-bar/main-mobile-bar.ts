import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { RingLogo } from '@shared/ui/ring-logo/ring-logo';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';
import { AVATAR_TOKENS, injectCurrentUser } from '../main-nav';

/** Mobile top bar (Figma `55:3098` top): logo, theme, bell placeholder, avatar menu. */
@Component({
  selector: 'app-main-mobile-bar',
  imports: [RouterLink, Avatar, Button, Menu, Tooltip, RingLogo, ThemeToggle],
  templateUrl: './main-mobile-bar.html',
  styleUrl: './main-mobile-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainMobileBar {
  protected readonly user = injectCurrentUser();
  protected readonly avatarTokens = AVATAR_TOKENS;
}
