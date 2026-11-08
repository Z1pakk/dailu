import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { HeatCell, monthLabels } from './heatmap.grid';

interface CellPos {
  week: number;
  day: number;
}

/** Default cell size; bigger cells (dashboard) get a proportionally bigger gap. */
const CELL = 11;
/** Width of the optional Mon/Wed/Fri column. */
const DAYS_W = 30;
/** Height of the optional month row under the grid. */
const MONTHS_H = 20;

/**
 * GitHub-style heatmap (Figma long-game `5:49`): title + Less/More legend above,
 * grid, month labels below. One tab stop for the whole grid; arrow keys move a
 * focus cursor and the popup follows it (hover works the same way).
 */
@Component({
  selector: 'app-heatmap',
  templateUrl: './heatmap.html',
  styleUrl: './heatmap.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.hm--compact]': '!$showMonths() || $fill()',
    // Fill mode: never upscale past the natural size, so cells keep $cell px and labels stay small.
    '[style.--hm-max-w.px]': '$fill() ? $svgWidth() : null',
    '[style.--hm-tip-x.%]': '$active()?.left',
    '[style.--hm-tip-y.%]': '$active()?.top',
  },
})
export class Heatmap {
  public readonly $weeks = input.required<readonly (HeatCell | null)[][]>({
    alias: 'weeks',
  });
  public readonly $caption = input<string>('', { alias: 'caption' });
  public readonly $habitsPerDay = input(6, {
    alias: 'habitsPerDay',
    transform: numberAttribute,
  });
  /** Mon / Wed / Fri labels on the left (off in the Figma design). */
  public readonly $showDays = input(false, { alias: 'showDays', transform: booleanAttribute });
  /** Month labels under the grid. Off = compact (e.g. "last 20 weeks" on mobile). */
  public readonly $showMonths = input(true, { alias: 'showMonths', transform: booleanAttribute });
  /** Fit the container instead of keeping the full-year minimum width (e.g. a few weeks in a card). */
  public readonly $fill = input(false, { alias: 'fill', transform: booleanAttribute });
  /** Cell size in px (SVG units). */
  public readonly $cell = input(CELL, { alias: 'cellSize', transform: numberAttribute });

  private readonly _$gap = computed(() => Math.max(2, Math.round(this.$cell() / 6)));
  protected readonly $step = computed(() => this.$cell() + this._$gap());
  protected readonly days = ['Mon', '', 'Wed', '', 'Fri', '', ''];
  protected readonly levels = [0, 1, 2, 3, 4];

  protected readonly $gridX = computed(() => (this.$showDays() ? DAYS_W : 0));
  protected readonly $gridHeight = computed(() => 7 * this.$step() - this._$gap());
  protected readonly $svgHeight = computed(
    () => this.$gridHeight() + (this.$showMonths() ? MONTHS_H : 0),
  );
  protected readonly $months = computed(() => monthLabels(this.$weeks()));
  protected readonly $svgWidth = computed(
    () => this.$gridX() + this.$weeks().length * this.$step() - this._$gap(),
  );

  private readonly _$hover = signal<CellPos | null>(null);
  private readonly _$cursor = signal<CellPos | null>(null);

  protected readonly $active = computed(() => {
    const pos = this._$hover() ?? this._$cursor();
    if (!pos) {
      return null;
    }
    const cell = this.$weeks()[pos.week]?.[pos.day];
    if (!cell) {
      return null;
    }
    const left = ((this.$gridX() + pos.week * this.$step() + this.$cell() / 2) / this.$svgWidth()) * 100;
    let align: 'start' | 'center' | 'end' = 'center';
    if (left < 20) {
      align = 'start';
    } else if (left > 80) {
      align = 'end';
    }
    return {
      ...pos,
      align,
      // Percentages, because the SVG scales to its container.
      left,
      top: ((pos.day * this.$step()) / this.$svgHeight()) * 100,
      text: `${format(parseISO(cell.date), 'EEE d MMM')} · ${cell.count} of ${this.$habitsPerDay()} habits`,
    };
  });

  protected readonly $label = computed(
    () => `${this.$caption() || 'Habit heatmap'}. Use arrow keys to read each day.`,
  );

  protected hover(week: number, day: number): void {
    this._$hover.set({ week, day });
  }

  protected unhover(): void {
    this._$hover.set(null);
  }

  protected onFocus(): void {
    if (this._$cursor()) {
      return;
    }
    const weeks = this.$weeks();
    for (let week = 0; week < weeks.length; week++) {
      const day = weeks[week]!.findIndex((c) => c !== null);
      if (day >= 0) {
        this._$cursor.set({ week, day });
        return;
      }
    }
  }

  protected onBlur(): void {
    this._$cursor.set(null);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const pos = this._$cursor();
    if (!pos) {
      return;
    }
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = moves[event.key];
    if (!move) {
      return;
    }
    event.preventDefault();
    const week = Math.min(this.$weeks().length - 1, Math.max(0, pos.week + move[0]));
    const day = Math.min(6, Math.max(0, pos.day + move[1]));
    this._$cursor.set({ week, day });
  }
}
