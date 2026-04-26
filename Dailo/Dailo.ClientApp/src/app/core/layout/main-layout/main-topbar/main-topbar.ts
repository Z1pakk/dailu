import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Menu } from 'primeng/menu';
import { MenuItem, MenuItemCommandEvent } from 'primeng/api';
import { Store } from '@ngxs/store';
import { AuthLogout } from '@auth/state/auth.action';

@Component({
  selector: 'app-main-topbar',
  imports: [Menu],
  templateUrl: './main-topbar.html',
  styleUrl: './main-topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainTopbar {
  private readonly _store = inject(Store);

  protected readonly profileMenuItems: MenuItem[] = [
    {
      label: 'Profile',
      icon: 'pi pi-user',
    },
    {
      label: 'Settings',
      icon: 'pi pi-cog',
    },
    {
      label: 'Log out',
      icon: 'pi pi-power-off',
      command: (_: MenuItemCommandEvent) => {
        this._store.dispatch(new AuthLogout());
      },
    },
  ];
}
