import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
  numberAttribute,
} from '@angular/core';

/** Dailu ring mark + "dailu" wordmark (Figma nav logo `3:316`). */
@Component({
  selector: 'app-ring-logo',
  templateUrl: './ring-logo.html',
  styleUrl: './ring-logo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--logo-size.px]': '$size()',
    '[class.ring-logo--inverse]': '$inverse()',
  },
})
export class RingLogo {
  /** Height of the ring mark in px; the wordmark scales with it. */
  public readonly $size = input(22, { alias: 'size', transform: numberAttribute });
  public readonly $withWordmark = input(true, {
    alias: 'withWordmark',
    transform: booleanAttribute,
  });
  /** For always-dark surfaces (e.g. the app sidebar): light wordmark and track. */
  public readonly $inverse = input(false, {
    alias: 'inverse',
    transform: booleanAttribute,
  });
}
