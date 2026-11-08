import { computed, inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { MenuItem } from 'primeng/api';
import { AuthLogout } from '@auth/state/auth.action';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';

export interface MainNavItem {
  label: string;
  icon: string;
  /** Relative to /app. `null` = not built yet (rendered disabled, "Coming soon"). */
  route: string | null;
}

/**
 * Sidebar nav (Figma `54:2300`). Icons per the Figma "Icon" component notes.
 * Profile is reached from the user row's menu, so it isn't listed here.
 */
export const MAIN_NAV: readonly MainNavItem[] = [
  { label: 'Dashboard', icon: 'pi pi-th-large', route: 'dashboard' },
  { label: 'Habits', icon: 'pi pi-check-circle', route: 'habits' },
  { label: 'Entries', icon: 'pi pi-list', route: 'entries' },
  { label: 'Insights', icon: 'pi pi-sparkles', route: null },
  { label: 'Tags', icon: 'pi pi-tag', route: 'tags' },
  { label: 'Integrations', icon: 'pi pi-link', route: 'profile/integrations' },
];

/** Avatar initials, full name and the Profile / Log out menu — shared by the sidebar and mobile bar. */
export function injectCurrentUser() {
  const store = inject(Store);
  const $profile = store.selectSignal(UserProfileStateSelectors.getSlices.profile);

  const menuItems: MenuItem[] = [
    { label: 'Profile', icon: 'pi pi-user', routerLink: '/app/profile' },
    {
      label: 'Log out',
      icon: 'pi pi-power-off',
      command: () => store.dispatch(new AuthLogout()),
    },
  ];

  return {
    $fullName: computed(() => {
      const p = $profile();
      return p ? `${p.firstName} ${p.lastName}`.trim() : '';
    }),
    $initials: computed(() => {
      const p = $profile();
      if (!p) {
        return '';
      }
      return `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase();
    }),
    menuItems,
  };
}

/** p-avatar tokens matching Figma Avatar `7:257` (36px, highlight tint). */
export const AVATAR_TOKENS = {
  root: {
    width: '36px',
    height: '36px',
    fontSize: '14px',
    background: '{highlight.background}',
    color: '{primary.color}',
  },
};
