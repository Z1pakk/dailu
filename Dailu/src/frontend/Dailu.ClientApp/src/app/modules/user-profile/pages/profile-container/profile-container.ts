import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenubarDesignTokens } from '@primeuix/themes/types/menubar';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-profile-container',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Button],
  templateUrl: './profile-container.html',
  styleUrl: './profile-container.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileContainer {
  protected readonly horizontalMenuDesignToken: MenubarDesignTokens = {
    root: {
      borderColor: 'transparent',
    },
    item: {
      activeBackground: '--pi-color-primary-100',
      activeColor: 'white',
    },
  };

  protected readonly profileMenuItems: MenuItem[] = [
    {
      label: 'Main',
      icon: 'pi pi-user',
      routerLink: 'main',
    },
    {
      label: 'Integrations',
      icon: 'pi pi-share-alt',
      routerLink: 'integrations',
    },
  ];
}
