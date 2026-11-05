import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RingLogo } from '@shared/ui/ring-logo/ring-logo';

@Component({
  selector: 'app-main-footer',
  imports: [RingLogo],
  templateUrl: './main-footer.html',
  styleUrl: './main-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainFooter {
  protected readonly currentYear = new Date().getFullYear();
}
