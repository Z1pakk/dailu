import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import {
  describeArc,
  formatMinutes,
  minutesToClockAngle,
  Point,
  polarToPoint,
} from '@shared/ui/charts/arc.geometry';
import {
  ClockHabit,
  ClockHabitView,
  clockSummary,
  resolveClockHabits,
  sourceLabel,
} from './day-clock.model';

interface ClockGeometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  /** 0 = no face disc. */
  faceR: number;
  trackR: number;
  trackWidth: number;
  elapsedR: number;
  hourR: number;
  labelR: number;
  hours: number[];
}

/** Desktop: Figma component `3:306` (900×400). */
const DESKTOP: ClockGeometry = {
  width: 900,
  height: 400,
  cx: 450,
  cy: 380,
  faceR: 318,
  trackR: 270,
  trackWidth: 40,
  elapsedR: 236,
  hourR: 205,
  labelR: 352,
  hours: [6, 9, 12, 15, 18, 21, 24],
};

/** Mobile: Figma component `9:232` (335×190) — no face, no outside labels. */
const COMPACT: ClockGeometry = {
  width: 335,
  height: 190,
  cx: 167.5,
  cy: 180,
  faceR: 0,
  trackR: 147,
  trackWidth: 26,
  elapsedR: 126,
  hourR: 108,
  labelR: 0,
  hours: [6, 24],
};

/** "in 1h 48m" / "in 12m" / "now". */
const relativeMinutes = (minutes: number): string => {
  if (minutes <= 0) {
    return 'now';
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
};

/** Re-read the wall clock this often so the hand never lags more than 15s. */
const TICK_MS = 15_000;

interface ClockSegment {
  view: ClockHabitView;
  path: string;
  /** Popup / aria detail: "Strava 06:52" or "at 18:00". */
  detail: string;
  /** Short outside label: "Strava", "by you" or "at 18:00". */
  caption: string;
  labelAt: Point;
  labelAnchor: 'start' | 'middle' | 'end';
  /** Popup anchor as % of the clock box. */
  popupLeft: number;
  popupTop: number;
}

@Component({
  selector: 'app-day-clock',
  templateUrl: './day-clock.html',
  styleUrl: './day-clock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'day-clock',
    '[class.day-clock--compact]': '$compact()',
    '[style.--clock-track-w]': '$geometry().trackWidth',
    '[style.--clock-popup-left.%]': '$active()?.popupLeft',
    '[style.--clock-popup-top.%]': '$active()?.popupTop',
  },
})
export class DayClock {
  private readonly _destroyRef = inject(DestroyRef);

  public readonly $habits = input.required<readonly ClockHabit[]>({
    alias: 'habits',
  });
  /** Fixed time (previews). When null the clock follows the wall clock. */
  public readonly $now = input<Date | null>(null, { alias: 'now' });
  public readonly $compact = input(false, {
    alias: 'compact',
    transform: booleanAttribute,
  });
  /** Compact mode's own "today" list under the dial; off when the host renders its own list. */
  public readonly $showList = input(true, {
    alias: 'showList',
    transform: booleanAttribute,
  });

  private readonly _$tick = signal(new Date());

  protected readonly $geometry = computed(() => (this.$compact() ? COMPACT : DESKTOP));

  protected readonly $frame = computed(() => {
    const g = this.$geometry();
    return {
      viewBox: `0 0 ${g.width} ${g.height}`,
      face: g.faceR
        ? `M ${g.cx - g.faceR} ${g.cy} A ${g.faceR} ${g.faceR} 0 0 1 ${g.cx + g.faceR} ${g.cy} Z`
        : null,
      track: describeArc(g.cx, g.cy, g.trackR, 180, 360),
      hours: g.hours.map((h) => ({
        label: String(h % 24).padStart(2, '0'),
        at: polarToPoint(g.cx, g.cy, g.hourR, minutesToClockAngle(h * 60)),
      })),
    };
  });

  /** Hover and keyboard focus are tracked separately so they can't cancel each other. */
  private readonly _$hoverId = signal<string | null>(null);
  private readonly _$focusId = signal<string | null>(null);
  protected readonly $activeId = computed(() => this._$hoverId() ?? this._$focusId());

  private readonly _$nowMinutes = computed(() => {
    const now = this.$now() ?? this._$tick();
    return now.getHours() * 60 + now.getMinutes();
  });

  private readonly _$views = computed(() =>
    resolveClockHabits(this.$habits(), this._$nowMinutes()),
  );

  protected readonly $summary = computed(() => clockSummary(this._$views()));

  protected readonly $segments = computed<ClockSegment[]>(() => {
    const g = this.$geometry();
    return this._$views().map((view) => {
      const mid = (view.startAngle + view.endAngle) / 2;
      const labelAt = polarToPoint(g.cx, g.cy, g.labelR, mid);
      const popupAt = polarToPoint(g.cx, g.cy, g.trackR, mid);
      const done = view.state === 'done';
      return {
        view,
        path: describeArc(g.cx, g.cy, g.trackR, view.startAngle, view.endAngle),
        detail: done ? view.doneLabel : view.waitingLabel,
        caption: done ? sourceLabel(view.source) : view.waitingLabel,
        labelAt,
        labelAnchor:
          labelAt.x < g.cx - 60 ? 'end' : labelAt.x > g.cx + 60 ? 'start' : 'middle',
        popupLeft: (popupAt.x / g.width) * 100,
        popupTop: (popupAt.y / g.height) * 100,
      };
    });
  });

  protected readonly $active = computed(
    () => this.$segments().find((s) => s.view.id === this.$activeId()) ?? null,
  );

  private readonly _$nowAngle = computed(() =>
    minutesToClockAngle(this._$nowMinutes()),
  );

  protected readonly $nowDot = computed(() => {
    const g = this.$geometry();
    return {
      ...polarToPoint(g.cx, g.cy, g.trackR, this._$nowAngle()),
      r: g.trackWidth * 0.24,
    };
  });

  protected readonly $elapsedPath = computed(() => {
    const g = this.$geometry();
    const angle = this._$nowAngle();
    return angle > 180.5 ? describeArc(g.cx, g.cy, g.elapsedR, 180, angle) : null;
  });

  protected readonly $time = computed(() => formatMinutes(this._$nowMinutes()));

  /** Mobile "today" list under the compact clock (Figma 9:240 → today-list). */
  protected readonly $listRows = computed(() => {
    const now = this._$nowMinutes();
    return this._$views().map((view) => {
      let caption: string;
      if (view.state === 'done') {
        caption = view.source === 'manual' ? 'checked by you' : sourceLabel(view.source);
      } else if (view.state === 'next') {
        caption = relativeMinutes(view.startMinutes - now);
      } else {
        caption = 'scheduled';
      }
      return {
        id: view.id,
        time: formatMinutes(view.startMinutes),
        name: view.name,
        caption,
        state: view.state,
        manual: view.source === 'manual',
      };
    });
  });

  protected readonly $nextText = computed(() => {
    const { next } = this.$summary();
    // Completion-based habits have no real time of day: name the next one, no time.
    const isUntimed = this._$views().some((v) => v.isDone !== undefined);
    if (next) {
      return isUntimed ? `Next: ${next.name}` : `Next: ${next.name} at ${formatMinutes(next.startMinutes)}`;
    }
    if (isUntimed) {
      return this._$views().length > 0 ? 'All done for today' : '';
    }
    const first = this._$views()[0];
    return first
      ? `Day closed · see you at ${formatMinutes(first.startMinutes)}`
      : '';
  });

  constructor() {
    afterNextRender(() => {
      interval(TICK_MS)
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(() => this._$tick.set(new Date()));
    });
  }

  /**
   * One delegated listener for the whole SVG: the active segment is simply the one
   * under the pointer. Per-segment enter/leave pairs flickered at segment edges.
   */
  protected onPointerOver(event: PointerEvent): void {
    const target = event.target as Element | null;
    const id = target?.closest('[data-habit]')?.getAttribute('data-habit') ?? null;
    if (id !== this._$hoverId()) {
      this._$hoverId.set(id);
    }
  }

  protected onPointerLeave(): void {
    this._$hoverId.set(null);
  }

  protected onFocus(id: string): void {
    this._$focusId.set(id);
  }

  protected onBlur(id: string): void {
    if (this._$focusId() === id) {
      this._$focusId.set(null);
    }
  }
}
