import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { describeArc, Point, polarToPoint } from '@shared/ui/charts/arc.geometry';
import { SectionHeader } from '@shared/ui/section-header/section-header';
import { SOURCE_NAMES } from '@shared/ui/day-clock/day-clock.model';
import { EXAMPLE_DAY } from '../../../../data/example-day';

/** The example day frozen at 16:12, Thu 5 Nov (Figma `4:265`: "4/6"). */
const FROZEN_AT = 16 * 60 + 12;

const CX = 320;
const CY = 240;
const RING_R = 150;
const LINE_FROM = 172;
const LINE_TO = 196;
const LABEL_R = 206;

type SourceState = 'auto' | 'manual' | 'waiting';

interface SourceSegment {
  id: string;
  name: string;
  detail: string;
  state: SourceState;
  path: string;
  lineFrom: Point;
  lineTo: Point;
  label: Point;
  anchor: 'start' | 'middle' | 'end';
}

/** 24h ring: 00:00 at the top, clockwise, 15° per hour. */
const minutesToDialAngle = (minutes: number): number => -90 + minutes / 4;

/** Sources (Figma `4:265`): every check shows where it came from. */
@Component({
  selector: 'app-landing-sources',
  imports: [SectionHeader],
  templateUrl: './landing-sources.html',
  styleUrls: ['../../_landing-layout.scss', './landing-sources.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingSources {
  protected readonly cx = CX;
  protected readonly cy = CY;
  protected readonly ringR = RING_R;

  protected readonly points = [
    'Source and time on every check',
    'Undo an auto-check in one tap',
    'Manual check-ins always welcome',
  ];

  protected readonly segments: SourceSegment[] = EXAMPLE_DAY.map((habit) => {
    const done = FROZEN_AT >= habit.endMinutes;
    const state: SourceState = !done ? 'waiting' : habit.source === 'manual' ? 'manual' : 'auto';
    const start = minutesToDialAngle(habit.startMinutes);
    const end = minutesToDialAngle(habit.endMinutes);
    const mid = (start + end) / 2;
    const label = polarToPoint(CX, CY, LABEL_R, mid);
    return {
      id: habit.id,
      name: habit.name,
      detail: done ? habit.doneLabel : `waiting · ${SOURCE_NAMES[habit.source]}`,
      state,
      path: describeArc(CX, CY, RING_R, start, end),
      lineFrom: polarToPoint(CX, CY, LINE_FROM, mid),
      lineTo: polarToPoint(CX, CY, LINE_TO, mid),
      label,
      anchor: label.x < CX - 40 ? 'end' : label.x > CX + 40 ? 'start' : 'middle',
    };
  });

  protected readonly doneCount = this.segments.filter((s) => s.state !== 'waiting').length;

  private readonly _$hoverId = signal<string | null>(null);
  private readonly _$focusId = signal<string | null>(null);
  protected readonly $active = computed(() => {
    const id = this._$hoverId() ?? this._$focusId();
    return this.segments.find((s) => s.id === id) ?? null;
  });

  /** Delegated: the active segment is the one under the pointer (no per-segment enter/leave). */
  protected onPointerOver(event: PointerEvent): void {
    const id = (event.target as Element | null)?.closest('[data-seg]')?.getAttribute('data-seg') ?? null;
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
