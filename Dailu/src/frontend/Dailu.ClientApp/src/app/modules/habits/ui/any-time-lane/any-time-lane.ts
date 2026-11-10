import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AnyTimeLane as AnyTimeLaneModel, formatDuration } from '@habits/lib/habit-today';
import { PercentPositionDirective } from '@shared/directives/percent-position.directive';

/**
 * "Any time today" lane (Figma: Habits clock card, right lane; Dashboard Today card, under
 * the dial): a bar that fills up to now, ending at midnight, and today's due any-time
 * habits — done ones first, in the order they were ticked.
 */
@Component({
  selector: 'app-any-time-lane',
  imports: [PercentPositionDirective],
  templateUrl: './any-time-lane.html',
  styleUrl: './any-time-lane.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnyTimeLane {
  public readonly $lane = input.required<AnyTimeLaneModel>({ alias: 'lane' });

  protected readonly $timeLeft = computed(() => formatDuration(this.$lane().minutesLeft));
}
