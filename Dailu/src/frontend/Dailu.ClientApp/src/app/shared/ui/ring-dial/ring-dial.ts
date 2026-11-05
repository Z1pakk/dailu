import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
  output,
} from '@angular/core';
import { describeArc, ringSegments } from '@shared/ui/charts/arc.geometry';

export type DialSegmentState = 'auto' | 'manual' | 'scheduled' | 'missed';

export interface DialSegment {
  state: DialSegmentState;
  label: string;
  detail: string;
}

/** Drawing space: 100×100, ring radius 40, stroke 10. */
const C = 50;
const R = 40;

@Component({
  selector: 'app-ring-dial',
  templateUrl: './ring-dial.html',
  styleUrl: './ring-dial.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--dial-size.px]': '$size()',
  },
})
export class RingDial {
  public readonly $segments = input.required<readonly DialSegment[]>({
    alias: 'segments',
  });
  public readonly $size = input(120, { alias: 'size', transform: numberAttribute });
  /** Gap between segments in degrees. */
  public readonly $gap = input(8, { alias: 'gap', transform: numberAttribute });
  public readonly $centerTitle = input<string>('', { alias: 'centerTitle' });
  public readonly $centerCaption = input<string>('', { alias: 'centerCaption' });
  /** Makes segments focusable (off for small decorative dials inside a focusable parent). */
  public readonly $interactive = input(true, { alias: 'interactive' });

  /** Emits the hovered/focused segment, or null when it is left. */
  public readonly activeChange = output<DialSegment | null>();

  protected readonly c = C;
  protected readonly r = R;

  protected readonly $paths = computed(() => {
    const segments = this.$segments();
    const gap = segments.length > 1 ? this.$gap() : 0;
    return ringSegments(segments.length, gap).map((range, i) => ({
      segment: segments[i]!,
      d: describeArc(C, C, R, range.start, range.end),
    }));
  });

  protected enter(segment: DialSegment): void {
    this.activeChange.emit(segment);
  }

  protected leave(): void {
    this.activeChange.emit(null);
  }
}
