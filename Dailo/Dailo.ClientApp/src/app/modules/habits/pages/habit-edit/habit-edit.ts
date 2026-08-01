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
import { HabitEditFacadeService } from '@habits/pages/habit-edit/habit-edit-facade.service';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { HabitEditModalData } from '@habits/pages/habit-edit/type/habit-edit-modal.type';
import { Store } from '@ngxs/store';
import { TagGetTags } from '@tags/state/tag.action';
import { HabitFormWizard } from '@habits/ui/habit-form-wizard/habit-form-wizard';
import { HabitFormWizardStep } from '@habits/ui/habit-form-wizard/habit-form-wizard-step.type';
import { HabitGeneralStep } from '@habits/ui/habit-general-step/habit-general-step';
import { HabitScheduleStep } from '@habits/ui/habit-schedule-step/habit-schedule-step';
import { HabitAutomationStep } from '@habits/ui/habit-automation-step/habit-automation-step';
import { HabitTagsStep } from '@habits/ui/habit-tags-step/habit-tags-step';

@Component({
  selector: 'app-habit-edit',
  imports: [
    ReactiveFormsModule,
    HabitFormWizard,
    HabitGeneralStep,
    HabitScheduleStep,
    HabitAutomationStep,
    HabitTagsStep,
  ],
  providers: [HabitEditFacadeService],
  templateUrl: './habit-edit.html',
  styleUrl: './habit-edit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitEdit implements OnInit {
  private readonly _store = inject(Store);
  private readonly _config = inject<DynamicDialogConfig<HabitEditModalData>>(
    DynamicDialogConfig<HabitEditModalData>,
  );
  private readonly _habitEditService = inject(HabitEditFacadeService);

  private get _data(): HabitEditModalData {
    return this._config.data!;
  }

  protected readonly $tagSelectItems = this._habitEditService.$tagSelectItems;
  protected readonly $githubRepoSelectItems =
    this._habitEditService.$githubRepoSelectItems;
  protected readonly $githubReposLoading =
    this._habitEditService.$githubReposLoading;
  protected readonly editHabitForm = this._habitEditService.editHabitForm;

  protected readonly activeStepIndex = signal(0);
  protected readonly wizardSteps: HabitFormWizardStep[] = [
    { label: 'General', description: 'Name, description, type' },
    { label: 'Schedule', description: 'Frequency, target, dates' },
    { label: 'Automation', description: 'Optional source + filter' },
    { label: 'Tags', description: 'Optional organization' },
  ];

  private readonly _$formStatus = toSignal(
    this.editHabitForm.statusChanges.pipe(
      startWith(this.editHabitForm.status),
    ),
    { initialValue: this.editHabitForm.status },
  );

  protected readonly canGoNext = computed(() => {
    this._$formStatus();
    const controls = this.editHabitForm.controls;

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
      this._data.$isFormValid.set(this._habitEditService.$isFormValid());
    });
    this._data.submit = () => this._habitEditService.updateHabit();
  }

  ngOnInit() {
    this._store.dispatch(new TagGetTags());
  }
}
