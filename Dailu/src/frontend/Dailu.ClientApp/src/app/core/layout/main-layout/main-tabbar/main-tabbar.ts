import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface Tab {
  label: string;
  icon: string;
  route: string;
}

/** Mobile bottom tab bar (Figma `55:3098` bottom) with the centre "+" new-habit button. */
@Component({
  selector: 'app-main-tabbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './main-tabbar.html',
  styleUrl: './main-tabbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainTabbar {
  protected readonly leftTabs: readonly Tab[] = [
    { label: 'Today', icon: 'pi pi-th-large', route: '/app/dashboard' },
    { label: 'Habits', icon: 'pi pi-check-circle', route: '/app/habits' },
  ];
  protected readonly rightTabs: readonly Tab[] = [
    { label: 'Entries', icon: 'pi pi-list', route: '/app/entries' },
    { label: 'Profile', icon: 'pi pi-user', route: '/app/profile' },
  ];
}
