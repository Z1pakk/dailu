import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { HabitFormWizardStep } from '@habits/ui/habit-form-wizard/habit-form-wizard-step.type';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-habit-form-wizard',
  imports: [Button],
  templateUrl: './habit-form-wizard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitFormWizard {
  readonly steps = input.required<HabitFormWizardStep[]>();
  readonly activeIndex = model.required<number>();
  readonly nextDisabled = input<boolean>(false);

  protected goTo(index: number) {
    if (index <= this.activeIndex() || !this.nextDisabled()) {
      this.activeIndex.set(index);
    }
  }

  protected back() {
    this.activeIndex.update((index) => Math.max(0, index - 1));
  }

  protected next() {
    if (this.nextDisabled()) {
      return;
    }
    this.activeIndex.update((index) =>
      Math.min(this.steps().length - 1, index + 1),
    );
  }
}
