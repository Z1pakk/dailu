import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { ButtonDirective } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Avatar } from 'primeng/avatar';
import { AuthStateSelectors } from '@auth/state/auth.selector';
import { UserProfileStateSelectors } from '@user-profile/state/user-profile.selector';
import { UserProfileGetProfile } from '@user-profile/state/user-profile.action';
import { RingLogo } from '@shared/ui/ring-logo/ring-logo';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';

interface NavLink {
  label: string;
  fragment: string;
}

/** Landing nav (Figma `3:315`; logged in `33:1723`; mobile menus `13:340` / `33:4773`). */
@Component({
  selector: 'app-landing-topbar',
  imports: [RouterLink, ButtonDirective, Drawer, Avatar, RingLogo, ThemeToggle],
  templateUrl: './landing-topbar.html',
  styleUrl: './landing-topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingTopbar {
  private readonly _store = inject(Store);

  protected readonly links: NavLink[] = [
    { label: 'How it works', fragment: 'how-it-works' },
    { label: 'Streaks', fragment: 'streaks' },
    { label: 'Integrations', fragment: 'integrations' },
    { label: 'FAQ', fragment: 'faq' },
  ];

  protected readonly $isAuthenticated = this._store.selectSignal(
    AuthStateSelectors.getSlices.isAuthenticated,
  );
  private readonly _$profile = this._store.selectSignal(
    UserProfileStateSelectors.getSlices.profile,
  );

  /** Only the first name is shown — never the email. */
  protected readonly $firstName = computed(() => this._$profile()?.firstName ?? '');
  protected readonly $initials = computed(() => {
    const profile = this._$profile();
    if (!profile) {
      return '';
    }
    return `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase();
  });

  protected readonly $menuOpen = signal(false);

  /** Scoped PrimeNG design tokens (no ::ng-deep). */
  protected readonly avatarTokens = {
    root: {
      width: '32px',
      height: '32px',
      fontSize: '12px',
      background: '{highlight.background}',
      color: '{highlight.color}',
    },
  };

  constructor() {
    effect(() => {
      if (this.$isAuthenticated()) {
        this._store.dispatch(new UserProfileGetProfile());
      }
    });
  }

  protected closeMenu(): void {
    this.$menuOpen.set(false);
  }
}
