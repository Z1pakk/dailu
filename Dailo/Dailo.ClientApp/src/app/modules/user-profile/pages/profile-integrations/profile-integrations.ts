import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Store } from '@ngxs/store';
import { ProfileGithubIntegration } from './github/profile-github-integration';
import { ProfileStravaIntegration } from './strava/profile-strava-integration';
import { UserProfileGetIntegrationConfigs } from '@user-profile/state/user-profile.action';

@Component({
  selector: 'app-profile-integrations',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel, ProfileGithubIntegration, ProfileStravaIntegration],
  templateUrl: './profile-integrations.html',
  styleUrl: './profile-integrations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileIntegrations implements OnInit {
  private readonly _store = inject(Store);

  ngOnInit() {
    this._store.dispatch(new UserProfileGetIntegrationConfigs());
  }
}
