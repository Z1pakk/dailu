import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';

interface Stat {
  target: number;
  suffix: string;
  label: string;
  blue: boolean;
}

@Component({
  selector: 'app-landing-stats',
  imports: [RouterLink, ButtonDirective],
  templateUrl: './landing-stats.html',
  styleUrl: './landing-stats.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingStats implements AfterViewInit {
  @ViewChildren('counter') counterEls!: QueryList<ElementRef<HTMLElement>>;

  protected readonly stats: Stat[] = [
    { target: 1240, suffix: '+', label: 'habits tracked', blue: false },
    { target: 25, suffix: ' days', label: 'longest streak', blue: true },
    { target: 2, suffix: '', label: 'integrations live', blue: false },
  ];

  constructor(private readonly _zone: NgZone) {}

  ngAfterViewInit(): void {
    this._zone.runOutsideAngular(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target as HTMLElement;
            const target = +(el.dataset['target'] ?? 0);
            const suffix = el.dataset['suffix'] ?? '';
            this._countUp(el, target, suffix);
            observer.unobserve(el);
          });
        },
        { threshold: 0.5 },
      );
      this.counterEls.forEach((ref) => observer.observe(ref.nativeElement));
    });
  }

  private _countUp(el: HTMLElement, target: number, suffix: string): void {
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const interval = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = cur.toLocaleString() + suffix;
      if (cur >= target) clearInterval(interval);
    }, 30);
  }
}
