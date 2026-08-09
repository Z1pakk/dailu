import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Tab, TabList, Tabs } from 'primeng/tabs';
import { Store } from '@ngxs/store';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { UserProfileGetIntegrationConfigs } from '@user-profile/state/user-profile.action';

@Component({
  selector: 'app-profile-integrations',
  imports: [Tabs, TabList, Tab, RouterOutlet],
  templateUrl: './profile-integrations.html',
  styleUrl: './profile-integrations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileIntegrations implements OnInit {
  private readonly _store = inject(Store);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  protected readonly $activeTab = signal<string | undefined>(undefined);

  ngOnInit(): void {
    this._store.dispatch(new UserProfileGetIntegrationConfigs());

    this._router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        startWith(null),
        map(
          () => this._route.firstChild?.snapshot?.url?.at(0)?.path ?? 'github',
        ),
      )
      .subscribe((activeTabKey) => {
        this.$activeTab.set(activeTabKey);
      });
  }

  protected onTabChange(value: string | number | undefined): void {
    this._router.navigate([value], { relativeTo: this._route });
  }
}
