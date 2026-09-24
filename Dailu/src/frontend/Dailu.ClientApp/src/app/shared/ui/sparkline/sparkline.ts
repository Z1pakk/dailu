import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface SparklinePoint {
  x: number;
  y: number;
}

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 32;
const PADDING = 4;
const DRAWABLE_WIDTH = VIEW_WIDTH - PADDING * 2;
const DRAWABLE_HEIGHT = VIEW_HEIGHT - PADDING * 2;

@Component({
  selector: 'app-sparkline',
  templateUrl: './sparkline.html',
  host: { class: 'block h-full w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sparkline {
  readonly values = input.required<number[]>();
  readonly target = input<number>();

  protected readonly viewBox = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;

  protected readonly $hasData = computed(() => this.values().length > 0);

  private readonly $scale = computed(() => {
    const values = this.values();
    const target = this.target();
    const all = target === undefined ? values : [...values, target];

    const min = Math.min(...all);
    const max = Math.max(...all);

    return { min, range: max - min || 1 };
  });

  protected readonly $points = computed((): SparklinePoint[] => {
    const values = this.values();
    const { min, range } = this.$scale();
    const count = values.length;

    return values.map((value, index) => ({
      x: count <= 1 ? PADDING + DRAWABLE_WIDTH / 2 : PADDING + (index / (count - 1)) * DRAWABLE_WIDTH,
      y: PADDING + DRAWABLE_HEIGHT - ((value - min) / range) * DRAWABLE_HEIGHT,
    }));
  });

  protected readonly $polylinePoints = computed(() =>
    this.$points()
      .map((point) => `${point.x},${point.y}`)
      .join(' '),
  );

  protected readonly $lastPoint = computed(() => {
    const points = this.$points();
    return points.length > 0 ? points[points.length - 1] : undefined;
  });

  protected readonly $targetY = computed(() => {
    const target = this.target();
    if (target === undefined) return undefined;

    const { min, range } = this.$scale();
    return PADDING + DRAWABLE_HEIGHT - ((target - min) / range) * DRAWABLE_HEIGHT;
  });
}
