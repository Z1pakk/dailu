import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Tag } from 'primeng/tag';

interface IntegrationGroup {
  icon: string;
  label: string;
  status: 'live' | 'soon';
  desc: string;
  services: string[];
}

@Component({
  selector: 'app-landing-integrations',
  imports: [Tag],
  templateUrl: './landing-integrations.html',
  styleUrls: ['../../_layout.scss', './landing-integrations.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingIntegrations {
  protected readonly groups: IntegrationGroup[] = [
    { icon: '💻', label: 'Code & Development', status: 'live',
      desc: 'Track commits, pull requests, and coding streaks automatically.',
      services: ['⌥ Version control', '📦 Package activity', '🔀 Code reviews'] },
    { icon: '🏃', label: 'Fitness & Sports', status: 'live',
      desc: 'Log runs, rides, swims, and workouts without lifting a finger.',
      services: ['🚴 Cycling', '🏊 Swimming', '🏋️ Strength training'] },
    { icon: '✅', label: 'Productivity', status: 'soon',
      desc: 'Connect task managers and note-taking apps to track deep work.',
      services: ['📝 Task completion', '📖 Notes & writing', '⏱️ Time tracking'] },
    { icon: '❤️', label: 'Health & Wellness', status: 'soon',
      desc: 'Sync sleep, steps, and heart rate data from wearables and apps.',
      services: ['😴 Sleep tracking', '👟 Steps & movement', '💓 Heart rate zones'] },
  ];
}
