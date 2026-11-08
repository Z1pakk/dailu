import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { UserProfileGetProfile } from '@user-profile/state/user-profile.action';
import { RouterOutlet } from '@angular/router';
import { MainSidebar } from '@layout/main-layout/main-sidebar/main-sidebar';
import { MainMobileBar } from '@layout/main-layout/main-mobile-bar/main-mobile-bar';
import { MainTabbar } from '@layout/main-layout/main-tabbar/main-tabbar';

/** Desktop: sidebar + content. Below lg: top bar + content + bottom tab bar. */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, MainSidebar, MainMobileBar, MainTabbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  constructor() {
    // The sidebar and mobile bar show the user's name and initials.
    inject(Store).dispatch(new UserProfileGetProfile());
  }
}
