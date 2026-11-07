import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  TERMS_READ_TIME,
  TERMS_SECTIONS,
  TERMS_SHORT_VERSION,
  TERMS_UPDATED,
} from './terms-content';

/** Terms & Conditions (Figma `41:1564` desktop, `42:1590` mobile). */
@Component({
  selector: 'app-terms',
  imports: [RouterLink],
  templateUrl: './terms.html',
  styleUrl: './terms.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Terms {
  protected readonly updated = TERMS_UPDATED;
  protected readonly readTime = TERMS_READ_TIME;
  protected readonly shortVersion = TERMS_SHORT_VERSION;
  protected readonly sections = TERMS_SECTIONS;

  protected sectionNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
  }
}
