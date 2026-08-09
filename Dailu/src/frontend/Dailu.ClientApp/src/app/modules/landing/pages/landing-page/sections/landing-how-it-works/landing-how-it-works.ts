import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  Step,
  StepList,
  StepPanel,
  StepPanels,
  Stepper,
} from 'primeng/stepper';
import { Tag } from 'primeng/tag';

@Component({
  selector: 'app-landing-how-it-works',
  imports: [Stepper, StepList, Step, StepPanels, StepPanel, Tag],
  templateUrl: './landing-how-it-works.html',
  styleUrls: ['../../_layout.scss', './landing-how-it-works.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingHowItWorks {
  protected readonly $activeStep = signal(0);
}
