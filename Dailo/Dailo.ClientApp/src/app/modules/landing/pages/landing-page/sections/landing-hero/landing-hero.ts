import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import { NgClass } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';
import { format } from 'date-fns';
import { Tag } from 'primeng/tag';

interface HeatCell {
  day: number;
  date: Date;
  intensity: 0 | 1 | 2 | 3 | 4;
  count: number;
  today: boolean;
  tooltip: string;
}

const INTENSITY_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-zinc-100',
  1: 'bg-blue-100',
  2: 'bg-blue-200',
  3: 'bg-blue-400',
  4: 'bg-blue-500',
};

@Component({
  selector: 'app-landing-hero',
  imports: [RouterLink, ButtonDirective, NgClass, Tooltip, Tag, Button],
  templateUrl: './landing-hero.html',
  styleUrl: './landing-hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHero implements AfterViewInit, OnDestroy {
  @ViewChild('widget') widgetRef!: ElementRef<HTMLElement>;

  protected readonly intensityClasses = INTENSITY_CLASSES;
  protected intensityClass(lvl: number): string {
    return INTENSITY_CLASSES[lvl as 0 | 1 | 2 | 3 | 4] ?? '';
  }
  protected readonly $monthLabel = computed(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (this.COLS * 3 - 1));
    const startLabel = format(start, 'MMM d');
    const endLabel = format(today, 'MMM d, yyyy');
    return `${startLabel} – ${endLabel}`;
  });

  protected readonly COLS = 11; // 11 cols × 3 rows = 33 days rolling window

  protected readonly $heatCells = computed((): HeatCell[] => {
    const today = new Date();
    const totalCells = this.COLS * 3;
    const countByIntensity: Record<0 | 1 | 2 | 3 | 4, number> = {
      0: 0,
      1: 1,
      2: 3,
      3: 6,
      4: 10,
    };
    const cells: HeatCell[] = [];

    // i = 0 → oldest day, i = totalCells-1 → today (last cell)
    for (let i = totalCells - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const isToday = i === 0;
      const r = Math.random();
      // Minimum intensity 1 — every day has at least 1 entry
      const intensity: 0 | 1 | 2 | 3 | 4 = isToday
        ? Math.random() > 0.4
          ? 2
          : 1
        : r < 0.35
          ? 1
          : r < 0.65
            ? 2
            : r < 0.87
              ? 3
              : 4;

      const count = countByIntensity[intensity] + Math.floor(Math.random() * 2);
      const dateLabel = format(date, 'MMM d, yyyy');
      const tooltip =
        count === 0
          ? `${dateLabel} — no entries`
          : `${dateLabel} — ${count} ${count === 1 ? 'entry' : 'entries'}`;

      cells.push({
        day: date.getDate(),
        date,
        intensity,
        count,
        today: isToday,
        tooltip,
      });
    }
    return cells;
  });

  protected readonly $cols = computed(() => this.COLS);

  protected readonly $totalThisMonth = computed(
    () => this.$heatCells().filter((c) => c.intensity > 0).length,
  );

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

  protected toggleDone(name: string): void {
    this.$doneMap.update((m) => ({ ...m, [name]: true }));
  }

  private _rafId: number | null = null;
  private _targetX = 0;
  private _targetY = 0;
  private _curX = 0;
  private _curY = 0;
  private readonly _floatDepths = [0.018, 0.012, 0.022, 0.014];

  constructor(
    private readonly _el: ElementRef<HTMLElement>,
    private readonly _zone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    // intentionally empty — parallax driven by host events
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    const r = this._el.nativeElement.getBoundingClientRect();
    this._targetX = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    this._targetY = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    if (!this._rafId) {
      this._zone.runOutsideAngular(() => {
        this._rafId = requestAnimationFrame(() => this._tick());
      });
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this._targetX = 0;
    this._targetY = 0;
    if (!this._rafId) {
      this._zone.runOutsideAngular(() => {
        this._rafId = requestAnimationFrame(() => this._tick());
      });
    }
  }

  private _tick(): void {
    this._rafId = null;
    this._curX += (this._targetX - this._curX) * 0.08;
    this._curY += (this._targetY - this._curY) * 0.08;

    const floats =
      this._el.nativeElement.querySelectorAll<HTMLElement>('.hero-float-card');
    floats.forEach((card, i) => {
      const depth = this._floatDepths[i] ?? 0.016;
      const dx = this._curX * depth * window.innerWidth * 0.5;
      const dy = this._curY * depth * window.innerHeight * 0.4;
      card.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    if (this.widgetRef?.nativeElement) {
      const rx = this._curY * -6;
      const ry = this._curX * 6;
      this.widgetRef.nativeElement.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }

    const atRest =
      Math.abs(this._targetX - this._curX) < 0.001 &&
      Math.abs(this._targetY - this._curY) < 0.001;

    if (!atRest) {
      this._zone.runOutsideAngular(() => {
        this._rafId = requestAnimationFrame(() => this._tick());
      });
    }
  }

  ngOnDestroy(): void {
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }
}
