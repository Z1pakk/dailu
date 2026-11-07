import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionHeader } from '@shared/ui/section-header/section-header';
import { WeekDayDial } from '@shared/ui/week-day-dial/week-day-dial';
import { EXAMPLE_WEEK } from '../../../../data/example-week';

/** Streaks (Figma `4:165`): stats + one dial per day of the week. */
@Component({
  selector: 'app-landing-streaks',
  imports: [SectionHeader, WeekDayDial],
  templateUrl: './landing-streaks.html',
  styleUrls: ['../../_landing-layout.scss', './landing-streaks.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingStreaks {
  protected readonly week = EXAMPLE_WEEK;
  protected readonly title = 'One dial a day.\nSeven make a habit.';

  protected readonly stats = [
    { value: '47', label: 'day streak' },
    { value: '92%', label: 'on time' },
    { value: '3/4', label: 'auto-checked' },
  ];

  protected readonly legend = [
    { state: 'auto', label: 'auto-checked' },
    { state: 'manual', label: 'checked by you' },
    { state: 'scheduled', label: 'scheduled' },
    { state: 'missed', label: 'missed' },
  ];
}
