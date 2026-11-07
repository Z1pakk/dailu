import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';
import { DialSegment, RingDial } from '@shared/ui/ring-dial/ring-dial';

/** One day of the streak week (Figma `20:950`): small ring, day name, done/total. */
@Component({
  selector: 'app-week-day-dial',
  imports: [RingDial],
  templateUrl: './week-day-dial.html',
  styleUrl: './week-day-dial.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekDayDial {
  public readonly $day = input.required<string>({ alias: 'day' });
  public readonly $segments = input.required<readonly DialSegment[]>({
    alias: 'segments',
  });
  public readonly $future = input(false, {
    alias: 'future',
    transform: booleanAttribute,
  });
  public readonly $size = input(64, { alias: 'size', transform: numberAttribute });

  private readonly _$counts = computed(() => {
    const segments = this.$segments();
    const auto = segments.filter((s) => s.state === 'auto').length;
    const manual = segments.filter((s) => s.state === 'manual').length;
    return { auto, manual, total: segments.length };
  });

  protected readonly $caption = computed(() => {
    if (this.$future()) {
      return '—';
    }
    const { auto, manual, total } = this._$counts();
    return `${auto + manual}/${total}`;
  });

  protected readonly $summary = computed(() => {
    const day = this.$day();
    if (this.$future()) {
      return `${day} · not yet`;
    }
    const { auto, manual } = this._$counts();
    return `${day} · ${this.$caption()} · ${auto} auto, ${manual} by you`;
  });
}
