import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-logo-widget',
  imports: [NgOptimizedImage],
  templateUrl: './logo-widget.html',
  styleUrl: './logo-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoWidget {
  private readonly _el = inject(ElementRef<HTMLElement>);

  public readonly $widthPx = input(120, {
    alias: 'widthPx',
    transform: numberAttribute,
  });
  public readonly $heightPx = input(35, {
    alias: 'heightPx',
    transform: numberAttribute,
  });

  public readonly $isWhite = input(false, {
    transform: booleanAttribute,
    alias: 'isWhite',
  });

  constructor() {
    effect(() => {
      const el = this._el.nativeElement;
      el.style.setProperty('--logo-w', `${this.$widthPx()}px`);
      el.style.setProperty('--logo-mh', `${this.$heightPx()}px`);
    });
  }
}
