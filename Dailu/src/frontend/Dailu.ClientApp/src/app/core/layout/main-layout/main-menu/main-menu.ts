import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-main-menu',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainMenu {
  protected readonly menuItems: MenuItem[] = [
    {
      id: 'main-menu',
      label: 'Main',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'pi pi-th-large',
          routerLink: 'dashboard',
        },
        {
          id: 'habits',
          label: 'My Habits',
          icon: 'pi pi-bolt',
          routerLink: 'habits',
        },
        {
          id: 'entries',
          label: 'My Entries',
          icon: 'pi pi-book',
          routerLink: 'entries',
        },
        {
          id: 'tags',
          label: 'My Tags',
          icon: 'pi pi-tag',
          routerLink: 'tags',
        },
      ],
    },
  ];
}
