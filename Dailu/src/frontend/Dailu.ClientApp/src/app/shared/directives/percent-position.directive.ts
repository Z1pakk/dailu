import { Directive, input } from '@angular/core';

/**
 * Positions an absolutely placed element by a 0..1 share of its container
 * (timeline slots, pills, the "now" marker) without inline styles in templates.
 */
@Directive({
  selector: '[appPercentLeft]',
  host: {
    '[style.left.%]': '$left() * 100',
    '[style.width.%]': '$width() === null ? null : $width()! * 100',
  },
})
export class PercentPositionDirective {
  public readonly $left = input.required<number>({ alias: 'appPercentLeft' });
  public readonly $width = input<number | null>(null, { alias: 'appPercentWidth' });
}
