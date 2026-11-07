import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Checkbox } from 'primeng/checkbox';
import { SectionHeader } from '@shared/ui/section-header/section-header';
import { formatMinutes } from '@shared/ui/charts/arc.geometry';

type SourceId = 'strava' | 'github' | 'google-health';

interface SourceRow {
  id: SourceId;
  letter: string;
  name: string;
  caption: string;
}

interface CheckRow {
  id: string;
  source: SourceId;
  /** Time the integration would report it, when auto-checked. */
  autoAt: string;
  defaultName: string;
  defaultTime: string;
}

type CheckState = { done: false } | { done: true; by: 'auto' | 'you'; at: string };

/**
 * How it works (Figma `4:76`). The three cards are a small working demo:
 * card 1 renames / re-times the first habit, card 2 connects sources,
 * card 3 ticks habits by hand.
 */
@Component({
  selector: 'app-landing-how-it-works',
  imports: [FormsModule, InputText, Select, ToggleSwitch, Checkbox, SectionHeader],
  templateUrl: './landing-how-it-works.html',
  styleUrls: ['../../_landing-layout.scss', './landing-how-it-works.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHowItWorks {
  // ---- Card 1: schedule ----
  protected readonly repeatOptions = ['Every day', 'Mon – Fri', 'Weekends'];
  protected readonly timeOptions = Array.from({ length: 11 }, (_, i) =>
    formatMinutes(5 * 60 + 30 + i * 15),
  );
  protected readonly $habitName = signal('Morning run');
  protected readonly $repeat = signal('Mon – Fri');
  protected readonly $time = signal('06:45');

  // ---- Card 2: sources ----
  protected readonly sources: SourceRow[] = [
    { id: 'strava', letter: 'S', name: 'Strava', caption: 'Runs, rides, swims' },
    { id: 'github', letter: 'G', name: 'GitHub', caption: 'Commits & pull requests' },
    { id: 'google-health', letter: 'G', name: 'Google Health', caption: 'Steps, sleep & workouts' },
  ];
  protected readonly $connected = signal<Record<SourceId, boolean>>({
    strava: true,
    github: true,
    'google-health': false,
  });

  // ---- Card 3: checks ----
  private readonly _checks: CheckRow[] = [
    { id: 'run', source: 'strava', autoAt: '06:52', defaultName: 'Morning run', defaultTime: '06:45' },
    { id: 'commit', source: 'github', autoAt: '14:21', defaultName: 'Ship a commit', defaultTime: '14:00' },
    { id: 'walk', source: 'google-health', autoAt: '18:14', defaultName: 'Evening walk', defaultTime: '18:00' },
  ];
  private readonly _$states = signal<Record<string, CheckState>>({
    run: { done: true, by: 'auto', at: '06:52' },
    commit: { done: true, by: 'auto', at: '14:21' },
    walk: { done: false },
  });

  protected readonly $rows = computed(() => {
    const states = this._$states();
    const connected = this.$connected();
    return this._checks.map((check, i) => {
      const state = states[check.id] ?? { done: false };
      const sourceName = this.sources.find((s) => s.id === check.source)!.name;
      // The first row is the habit scheduled in card 1.
      const name = i === 0 ? this.$habitName().trim() || check.defaultName : check.defaultName;
      const time = i === 0 ? this.$time() : check.defaultTime;

      let caption: string;
      if (state.done) {
        caption = state.by === 'auto' ? `auto · ${sourceName} · ${state.at}` : `by you · ${state.at}`;
      } else if (connected[check.source]) {
        caption = `waiting for ${sourceName}`;
      } else {
        caption = 'not connected · tick it yourself';
      }
      return { id: check.id, name, time, caption, done: state.done };
    });
  });

  protected setConnected(id: SourceId, value: boolean): void {
    this.$connected.update((c) => ({ ...c, [id]: value }));
  }

  protected setDone(id: string, done: boolean): void {
    const now = new Date();
    this._$states.update((s) => ({
      ...s,
      [id]: done
        ? { done: true, by: 'you', at: formatMinutes(now.getHours() * 60 + now.getMinutes()) }
        : { done: false },
    }));
  }
}
