import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HabitEntryModel } from '@habit-entries/models/habit-entry.model';
import { getTrendSeries, TrendRangeUnit } from '@habit-entries/lib/get-trend-series';

type ChartRange = 'day' | 'month' | 'year' | 'all';

interface RangeConfig {
  label: string;
  unit: TrendRangeUnit;
  bucketCount?: number;
  dateFormat: string;
}

const RANGE_CONFIG: Record<ChartRange, RangeConfig> = {
  day: { label: 'Day', unit: 'day', bucketCount: 30, dateFormat: 'MMM d' },
  month: { label: 'Month', unit: 'month', bucketCount: 12, dateFormat: 'MMM yyyy' },
  year: { label: 'Year', unit: 'year', dateFormat: 'yyyy' },
  all: { label: 'All', unit: 'month', dateFormat: 'MMM yyyy' },
};

const RANGE_OPTIONS: ChartRange[] = ['day', 'month', 'year', 'all'];

interface ChartPoint {
  x: number;
  y: number;
  value: number;
  date: Date;
}

const PADDING_TOP = 8;
const PADDING_BOTTOM = 8;
const PADDING_X = 2;
const DRAWABLE_HEIGHT = 100 - PADDING_TOP - PADDING_BOTTOM;
const DRAWABLE_WIDTH = 100 - PADDING_X * 2;
const BASELINE_Y = 100 - PADDING_BOTTOM;

function niceCeil(value: number): number {
  if (value <= 0) return 1;

  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / magnitude;

  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return niceFraction * magnitude;
}

@Component({
  selector: 'app-habit-daily-chart',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './habit-daily-chart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitDailyChart {
  readonly entries = input.required<HabitEntryModel[]>();
  readonly habitId = input.required<string>();
  readonly target = input<number>();
  readonly valueUnit = input('');

  protected readonly rangeOptions = RANGE_OPTIONS;
  protected readonly rangeLabels = RANGE_CONFIG;
  protected readonly range = signal<ChartRange>('day');

  protected readonly gridYs = [PADDING_TOP, PADDING_TOP + DRAWABLE_HEIGHT / 2, BASELINE_Y];

  protected readonly hoveredIndex = signal<number | null>(null);

  protected readonly $dateFormat = computed(() => RANGE_CONFIG[this.range()].dateFormat);

  protected readonly $series = computed(() => {
    const config = RANGE_CONFIG[this.range()];
    return getTrendSeries(this.entries(), this.habitId(), config.unit, config.bucketCount);
  });

  protected readonly $startDate = computed(() => this.$series()[0]?.date);
  protected readonly $endDate = computed(() => this.$series().at(-1)?.date);

  private readonly $max = computed(() => {
    const values = this.$series().map((point) => point.value);
    const target = this.target();
    return niceCeil(Math.max(...values, target ?? 0));
  });

  protected readonly $midValue = computed(() => this.$max() / 2);
  protected readonly $maxValue = computed(() => this.$max());

  protected readonly $points = computed((): ChartPoint[] => {
    const series = this.$series();
    const max = this.$max();
    const count = series.length;

    return series.map((point, index) => ({
      x: count <= 1 ? 50 : PADDING_X + (index / (count - 1)) * DRAWABLE_WIDTH,
      y: PADDING_TOP + DRAWABLE_HEIGHT * (1 - point.value / max),
      value: point.value,
      date: point.date,
    }));
  });

  protected readonly $polylinePoints = computed(() =>
    this.$points()
      .map((point) => `${point.x},${point.y}`)
      .join(' '),
  );

  protected readonly $areaPath = computed(() => {
    const points = this.$points();
    if (points.length === 0) return '';

    const first = points[0]!;
    const last = points[points.length - 1]!;
    const linePart = points.map((point) => `L ${point.x},${point.y}`).join(' ');

    return `M ${first.x},${BASELINE_Y} ${linePart} L ${last.x},${BASELINE_Y} Z`;
  });

  protected readonly $targetY = computed(() => {
    const target = this.target();
    if (target === undefined) return undefined;

    return PADDING_TOP + DRAWABLE_HEIGHT * (1 - target / this.$max());
  });

  protected readonly $hoveredPoint = computed(() => {
    const index = this.hoveredIndex();
    if (index === null) return undefined;

    return this.$points()[index];
  });

  protected readonly $lastPoint = computed(() => this.$points().at(-1));

  private readonly _tooltipEl = viewChild<ElementRef<HTMLElement>>('tooltipEl');
  private readonly _lastPointEl = viewChild<ElementRef<HTMLElement>>('lastPointEl');
  private readonly _hoveredPointEl = viewChild<ElementRef<HTMLElement>>('hoveredPointEl');

  constructor() {
    effect(() => this.positionElement(this._tooltipEl(), this.$hoveredPoint()));
    effect(() => this.positionElement(this._lastPointEl(), this.$lastPoint()));
    effect(() => this.positionElement(this._hoveredPointEl(), this.$hoveredPoint()));
  }

  private positionElement(elementRef: ElementRef<HTMLElement> | undefined, point: ChartPoint | undefined) {
    const el = elementRef?.nativeElement;
    if (!el || !point) return;

    el.style.left = `${point.x}%`;
    el.style.top = `${point.y}%`;
  }

  protected setRange(range: ChartRange) {
    this.range.set(range);
    this.hoveredIndex.set(null);
  }

  protected onPointerMove(event: PointerEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const count = this.$series().length;
    const index = Math.round(Math.min(Math.max(ratio, 0), 1) * (count - 1));

    this.hoveredIndex.set(index);
  }

  protected onPointerLeave() {
    this.hoveredIndex.set(null);
  }
}
