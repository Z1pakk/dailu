import { inject, Injectable, NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class IntersectionService {
  private readonly _zone = inject(NgZone);

  whenVisible(
    el: HTMLElement,
    callback: () => void,
    options?: IntersectionObserverInit,
  ): () => void {
    let observer: IntersectionObserver | null = null;
    this._zone.runOutsideAngular(() => {
      const obs = new window.IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          callback();
          obs.disconnect();
        });
      }, options);
      obs.observe(el);
      observer = obs;
    });
    return () => observer?.disconnect();
  }
}
