import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  NgZone,
} from '@angular/core';

type ParallaxEffect = (curX: number, curY: number) => void;

@Directive({
  selector: '[appParallaxContainer]',
  standalone: true,
  host: {
    '(mousemove)': 'onMouseMove($event)',
    '(mouseleave)': 'onMouseLeave()',
  },
})
export class ParallaxContainerDirective {
  private readonly _el = inject(ElementRef<HTMLElement>);
  private readonly _zone = inject(NgZone);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _effects = new Set<ParallaxEffect>();
  private _rafId: number | null = null;
  private _targetX = 0;
  private _targetY = 0;
  private _curX = 0;
  private _curY = 0;

  constructor() {
    this._destroyRef.onDestroy(() => {
      if (this._rafId !== null) cancelAnimationFrame(this._rafId);
      this._effects.clear();
    });
  }

  /**
   * Add effect which should be handled by handlers
   * @param fn
   */
  addEffect(fn: ParallaxEffect): () => void {
    this._effects.add(fn);
    return () => this._effects.delete(fn);
  }

  onMouseMove(e: MouseEvent): void {
    const r = this._el.nativeElement.getBoundingClientRect();
    this._targetX = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    this._targetY = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    this._scheduleFrame();
  }

  onMouseLeave(): void {
    this._targetX = 0;
    this._targetY = 0;
    this._scheduleFrame();
  }

  private _scheduleFrame(): void {
    if (this._rafId !== null) return;
    this._zone.runOutsideAngular(() => {
      this._rafId = requestAnimationFrame(() => this._tick());
    });
  }

  private _tick(): void {
    this._rafId = null;
    this._curX += (this._targetX - this._curX) * 0.08;
    this._curY += (this._targetY - this._curY) * 0.08;

    this._effects.forEach((fn) => fn(this._curX, this._curY));

    const atRest =
      Math.abs(this._targetX - this._curX) < 0.001 &&
      Math.abs(this._targetY - this._curY) < 0.001;

    if (!atRest) {
      this._rafId = requestAnimationFrame(() => this._tick());
    }
  }
}
