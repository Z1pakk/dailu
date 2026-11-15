import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AnyTimeLane as AnyTimeLaneModel, LaneMarker } from '@habits/lib/habit-today';
import { formatDuration } from '@shared/lib/date/format-duration';
import { PercentPositionDirective } from '@shared/directives/percent-position.directive';

/**
 * "Any time today" lane (Figma: Habits clock card, right lane; Dashboard Today card, under
 * the dial; markers spec `231:11011`): a bar that fills up to now, ending at midnight. Done
 * habits are markers where they were ticked (close ones grouped), open ones one marker at now;
 * hovering or focusing a marker lists its habits. The pills below are the full list.
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

  /** "Done · 10:40" for one habit, "Done · 2" for a group, "Still open · 3" at now. */
  protected cardTitle(marker: LaneMarker): string {
    if (marker.kind === 'open') {
      return `Still open · ${marker.items.length}`;
    }
    return marker.items.length === 1 ? `Done · ${marker.items[0]!.doneAt}` : `Done · ${marker.items.length}`;
  }

  protected markerLabel(marker: LaneMarker): string {
    const names = marker.items.map((i) => i.name).join(', ');
    return marker.kind === 'open' ? `Still open: ${names}` : `Done: ${names}`;
  }
}
