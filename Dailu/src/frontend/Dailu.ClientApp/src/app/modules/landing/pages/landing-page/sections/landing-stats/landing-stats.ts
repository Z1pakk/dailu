import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Store } from '@ngxs/store';
import { AuthStateSelectors } from '@auth/state/auth.selector';
import { IntersectionService } from '@shared/lib/intersection/intersection.service';

interface Stat {
  target: number;
  suffix: string;
  label: string;
  blue: boolean;
}

function countUp(el: HTMLElement, target: number, suffix: string): () => void {
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 40));
  const interval = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur.toLocaleString() + suffix;
    if (cur >= target) {
      clearInterval(interval);
    }
  }, 30);
  return () => clearInterval(interval);
}

@Component({
  selector: 'app-landing-stats',
  imports: [RouterLink, ButtonDirective],
  templateUrl: './landing-stats.html',
  styleUrls: ['../../_layout.scss', './landing-stats.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingStats {
  private readonly _store = inject(Store);
  private readonly _intersection = inject(IntersectionService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _counterEls = viewChildren<ElementRef<HTMLElement>>('counter');

  public readonly $isAuthenticated = this._store.selectSignal(
    AuthStateSelectors.getSlices.isAuthenticated,
  );

  protected readonly stats: Stat[] = [
    { target: 1240, suffix: '+', label: 'habits tracked', blue: false },
    { target: 25, suffix: ' days', label: 'longest streak', blue: true },
    { target: 2, suffix: '', label: 'integrations live', blue: false },
  ];

  constructor() {
    afterNextRender(() => {
      this._counterEls().forEach((ref) => {
        const el = ref.nativeElement;
        const observerCleanup = this._intersection.whenVisible(
          el,
          () => {
            const cancelCount = countUp(el, +(el.dataset['target'] ?? 0), el.dataset['suffix'] ?? '');
            this._destroyRef.onDestroy(cancelCount);
          },
          { threshold: 0.5 },
        );
        this._destroyRef.onDestroy(observerCleanup);
      });
    });
  }
}

