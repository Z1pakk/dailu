import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';

@Component({
  selector: 'app-landing-cta',
  imports: [RouterLink, ButtonDirective],
  templateUrl: './landing-cta.html',
  styleUrl: './landing-cta.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingCta {}
