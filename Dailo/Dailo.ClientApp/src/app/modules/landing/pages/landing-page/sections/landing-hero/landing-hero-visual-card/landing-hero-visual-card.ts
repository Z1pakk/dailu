import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { NgClass } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';
import { format } from 'date-fns/format';
import { ParallaxContainerDirective } from '@shared/directives/parallax-container.directive';
import { buildHeatCells, HeatIntensity, INTENSITY_CLASSES } from './heat-cells';

@Component({
  selector: 'app-landing-hero-visual-card',
  imports: [Button, Tag, NgClass, Tooltip],
  templateUrl: './landing-hero-visual-card.html',
  styleUrl: './landing-hero-visual-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHeroVisualCard {
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _parallax: ParallaxContainerDirective | null = inject(
    ParallaxContainerDirective,
    { optional: true },
  );

  private readonly _widgetRef = viewChild<ElementRef<HTMLElement>>('widget');

  protected readonly intensityClasses = INTENSITY_CLASSES;

  protected intensityClass(lvl: number): string {
    return INTENSITY_CLASSES[(lvl as HeatIntensity) ?? ''];
  }

  protected readonly COLS = 11;

  protected readonly $doneMap = signal<Record<string, boolean>>({
    'Open source': true,
  });

  protected readonly quickHabits: {
    name: string;
    tag: string;
    severity: 'success' | 'info' | 'secondary' | null;
  }[] = [
    { name: 'Morning run', tag: 'strava', severity: null },
    { name: 'Open source', tag: 'github', severity: null },
    { name: 'Read 30 min', tag: 'manual', severity: 'secondary' },
  ];

  protected readonly $heatCells = computed(() => buildHeatCells(this.COLS));

  protected readonly $streak = computed(() => {
    const cells = this.$heatCells();
    let streak = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      const cell = cells[i];
      if (!cell) break;
      if (cell.today && cell.intensity === 0) continue;
      if (cell.intensity === 0) break;
      streak++;
    }
    return Math.max(streak, 5);
  });

  protected readonly $cols = computed(() => this.COLS);

  protected readonly $totalThisMonth = computed(
    () => this.$heatCells().filter((c) => c.intensity > 0).length,
  );

  protected readonly $monthLabel = computed(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (this.COLS * 3 - 1));
    return `${format(start, 'MMM d')} – ${format(today, 'MMM d, yyyy')}`;
  });

  constructor() {
    afterNextRender(() => {
      const cleanup = this._parallax?.addEffect((curX, curY) => {
        const el = this._widgetRef()?.nativeElement;
        if (!el) {
          return;
        }
        const rx = curY * -6;
        const ry = curX * 6;
        el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
      if (cleanup) {
        this._destroyRef.onDestroy(cleanup);
      }
    });
  }

  protected toggleDone(name: string): void {
    this.$doneMap.update((m) => ({ ...m, [name]: true }));
  }
}
