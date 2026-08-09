import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';
import { HabitAddFacadeService } from '@habits/pages/habit-add/habit-add-facade.service';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { HabitAddModalData } from '@habits/pages/habit-add/type/habit-add-modal.type';
import { Store } from '@ngxs/store';
import { TagGetTags } from '@tags/state/tag.action';
import { HabitFormWizard } from '@habits/ui/habit-form-wizard/habit-form-wizard';
import { HabitFormWizardStep } from '@habits/ui/habit-form-wizard/habit-form-wizard-step.type';
import { HabitGeneralStep } from '@habits/ui/habit-general-step/habit-general-step';
import { HabitScheduleStep } from '@habits/ui/habit-schedule-step/habit-schedule-step';
import { HabitAutomationStep } from '@habits/ui/habit-automation-step/habit-automation-step';
import { HabitTagsStep } from '@habits/ui/habit-tags-step/habit-tags-step';

@Component({
  selector: 'app-habit-add',
  imports: [
    ReactiveFormsModule,
    HabitFormWizard,
    HabitGeneralStep,
    HabitScheduleStep,
    HabitAutomationStep,
    HabitTagsStep,
  ],
  providers: [HabitAddFacadeService],
  templateUrl: './habit-add.html',
  styleUrl: './habit-add.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitAdd implements OnInit {
  private readonly _store = inject(Store);
  private readonly _config = inject<DynamicDialogConfig<HabitAddModalData>>(
    DynamicDialogConfig<HabitAddModalData>,
  );
  private readonly _habitAddService = inject(HabitAddFacadeService);

  private get _data(): HabitAddModalData {
    return this._config.data!;
  }

  protected readonly $tagSelectItems = this._habitAddService.$tagSelectItems;
  protected readonly $githubRepoSelectItems =
    this._habitAddService.$githubRepoSelectItems;
  protected readonly $githubReposLoading =
    this._habitAddService.$githubReposLoading;

  protected readonly addHabitForm = this._habitAddService.addHabitForm;

  protected readonly activeStepIndex = signal(0);
  protected readonly wizardSteps: HabitFormWizardStep[] = [
    { label: 'General', description: 'Name, description, type' },
    { label: 'Schedule', description: 'Frequency, target, dates' },
    { label: 'Automation', description: 'Optional source + filter' },
    { label: 'Tags', description: 'Optional organization' },
  ];

  private readonly _$formStatus = toSignal(
    this.addHabitForm.statusChanges.pipe(startWith(this.addHabitForm.status)),
    { initialValue: this.addHabitForm.status },
  );

  protected readonly canGoNext = computed(() => {
    this._$formStatus();
    const controls = this.addHabitForm.controls;

    switch (this.activeStepIndex()) {
      case 0:
        return controls.name.valid && controls.description.valid && controls.type.valid;
      case 1:
        return (
          controls.frequencyType.valid &&
          controls.frequencyTimesPerPeriod.valid &&
          controls.targetValue.valid &&
          controls.targetUnit.valid &&
          controls.endDate.valid &&
          controls.milestoneTarget.valid
        );
      case 2:
        return (
          controls.automationSource.valid &&
          controls.githubRepositoryId.valid &&
          controls.githubRepositoryName.valid &&
          controls.githubEventTypes.valid &&
          controls.stravaActivityTypes.valid &&
          controls.googleHealthMetrics.valid
        );
      default:
        return true;
    }
  });

  constructor() {
    effect(() => {
      this._data.$isFormValid.set(this._habitAddService.$isFormValid());
    });
    this._data.submit = () => this._habitAddService.createHabit();
  }

  ngOnInit() {
    this._store.dispatch(new TagGetTags());
  }
}
