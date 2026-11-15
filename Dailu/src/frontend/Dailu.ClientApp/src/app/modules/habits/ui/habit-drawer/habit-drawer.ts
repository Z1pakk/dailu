import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngxs/store';
import { Drawer } from 'primeng/drawer';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { SelectButton } from 'primeng/selectbutton';
import { Select, SelectChangeEvent } from 'primeng/select';
import { MultiSelect } from 'primeng/multiselect';
import { DatePicker } from 'primeng/datepicker';
import { Message } from 'primeng/message';
import { Popover } from 'primeng/popover';
import { Listbox } from 'primeng/listbox';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { HabitModel } from '@habits/models/habit.model';
import { AutomationSource, automationSources } from '@habits/enums/automation-source.enum';
import { FrequencyType, frequencyTypes } from '@habits/enums/frequency-type.enum';
import { DayOfWeek, dayOfWeekShortLabels, weekButtonOrder } from '@habits/enums/day-of-week.enum';
import { githubEventTypeSelectItems } from '@habits/enums/github-event-type.enum';
import { stravaActivityTypeSelectItems } from '@habits/enums/strava-activity-type.enum';
import { googleHealthMetricSelectItems } from '@habits/enums/google-health-metric.enum';
import { TimeMode } from '@habits/lib/habit-form-mapping';
import { formatDuration } from '@shared/lib/date/format-duration';
import { PercentPositionDirective } from '@shared/directives/percent-position.directive';
import { HabitDrawerFacadeService } from '@habits/ui/habit-drawer/habit-drawer-facade.service';
import { HabitDrawerFormControls } from '@habits/ui/habit-drawer/habit-drawer-form.type';
import { TagGetTags } from '@tags/state/tag.action';
import { IntegrationGetSummaries } from '@integrations/state/integration.action';

interface SourceCard {
  value: AutomationSource;
  name: string;
  hint: string;
}

const MOBILE_QUERY = '(max-width: 767.98px)';

/** Up to 12 h in growing steps; the domain allows 1 min – 24 h (and the habit must end by midnight). */
const DURATION_CHOICES = [5, 10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720];

/** New / Edit habit drawer (Figma `69:3615`, full content `70:4165`, mobile `69:3757`). */
@Component({
  selector: 'app-habit-drawer',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Drawer,
    Button,
    InputText,
    InputNumber,
    SelectButton,
    Select,
    MultiSelect,
    DatePicker,
    Message,
    Popover,
    Listbox,
    Tag,
    Tooltip,
    PercentPositionDirective,
  ],
  providers: [HabitDrawerFacadeService],
  templateUrl: './habit-drawer.html',
  styleUrl: './habit-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitDrawer implements OnInit {
  private readonly _store = inject(Store);
  private readonly _destroyRef = inject(DestroyRef);
  protected readonly facade = inject(HabitDrawerFacadeService);

  public readonly $habit = input<HabitModel | null>(null, { alias: 'habit' });
  public readonly closed = output<void>();

  protected readonly form = this.facade.form;
  protected readonly controls: HabitDrawerFormControls = this.form.controls;
  protected readonly sources = automationSources;

  protected readonly $visible = signal(true);
  protected readonly $isMobile = signal(window.matchMedia(MOBILE_QUERY).matches);
  protected readonly $isEdit = computed(() => this.$habit() !== null);

  protected readonly frequencyTypes = frequencyTypes;
  protected readonly frequencyOptions: { label: string; value: FrequencyType }[] = [
    { label: 'Daily', value: frequencyTypes.daily },
    { label: 'Weekly', value: frequencyTypes.weekly },
    { label: 'Monthly', value: frequencyTypes.monthly },
  ];
  /** Monday first; the button shows the first letter. */
  protected readonly weekButtons: { day: DayOfWeek; letter: string; label: string }[] = weekButtonOrder.map((day) => ({
    day,
    letter: dayOfWeekShortLabels[day].charAt(0),
    label: dayOfWeekShortLabels[day],
  }));
  protected readonly monthDayNumbers = Array.from({ length: 31 }, (_, i) => i + 1);
  /** "At a time" needs known days; it's off for Weekly / Monthly with nothing picked. */
  protected readonly $timeModeOptions = computed<{ label: string; value: TimeMode; disabled: boolean }[]>(() => [
    { label: 'At a time', value: 'at', disabled: !this.facade.$hasFixedDays() },
    { label: 'Any time', value: 'any', disabled: false },
  ]);
  /** The choices, plus the habit's own duration when it isn't one of them (e.g. set through the API). */
  protected readonly $durationOptions = computed(() => {
    const current = this.facade.$timing().durationMinutes;
    const minutes =
      current !== null && !DURATION_CHOICES.includes(current)
        ? [...DURATION_CHOICES, current].sort((a, b) => a - b)
        : DURATION_CHOICES;
    return minutes.map((m) => ({ label: formatDuration(m), value: m }));
  });

  protected readonly sourceCards: SourceCard[] = [
    { value: automationSources.none, name: 'Manual', hint: 'tick it yourself' },
    { value: automationSources.github, name: 'GitHub', hint: 'commits & PRs' },
    { value: automationSources.strava, name: 'Strava', hint: 'runs & rides' },
    { value: automationSources.googleHealth, name: 'Google Health', hint: 'steps & exercise' },
  ];

  protected readonly githubEventItems = githubEventTypeSelectItems;
  protected readonly stravaActivityItems = stravaActivityTypeSelectItems;
  protected readonly googleHealthMetricItems = googleHealthMetricSelectItems;

  protected readonly $selectedTags = computed(() => {
    const ids = new Set(this._$tagIds());
    return this.facade.$tagSelectItems().filter((tag) => ids.has(tag.value as string));
  });
  private readonly _$tagIds = signal<string[]>([]);

  /** Some integration isn't connected yet — point to where it can be. */
  protected readonly $hasUnconnected = computed(() =>
    this.sourceCards.some((card) => card.value !== automationSources.none && !this.isConnected(card.value)),
  );

  constructor() {
    this._store.dispatch([new TagGetTags(), new IntegrationGetSummaries()]);

    const media = window.matchMedia(MOBILE_QUERY);
    const onChange = (event: MediaQueryListEvent) => this.$isMobile.set(event.matches);
    media.addEventListener('change', onChange);
    this._destroyRef.onDestroy(() => media.removeEventListener('change', onChange));
  }

  ngOnInit(): void {
    this.facade.init(this.$habit());
    this._$tagIds.set(this.controls.tagIds.value);
    this.controls.tagIds.valueChanges.subscribe((ids) => this._$tagIds.set(ids));
  }

  protected isConnected(source: AutomationSource): boolean {
    return this.facade.$connectedSources().has(source);
  }

  /** The habit's own source stays usable after its integration was disconnected. */
  protected isDisconnectedOwnSource(source: AutomationSource): boolean {
    return !this.isConnected(source) && this.$habit()?.automationSource === source;
  }

  protected isSourceDisabled(source: AutomationSource): boolean {
    if (source === automationSources.none) {
      return false;
    }
    return !this.isConnected(source) && !this.isDisconnectedOwnSource(source);
  }

  protected selectSource(source: AutomationSource): void {
    if (this.isSourceDisabled(source)) {
      return;
    }
    this.controls.automationSource.setValue(source);
    this.controls.automationSource.markAsDirty();
  }

  protected selectRepository(event: SelectChangeEvent): void {
    const item = this.facade.$githubRepoSelectItems().find((repo) => repo.value === event.value);
    this.controls.githubRepositoryName.setValue(item?.label ?? null);
  }

  protected removeTag(id: string): void {
    this.controls.tagIds.setValue(this.controls.tagIds.value.filter((tagId) => tagId !== id));
  }

  protected errorOf(name: keyof HabitDrawerFormControls): string | null {
    const control = this.controls[name];
    if (control.getError('serverError')) {
      return control.getError('serverError') as string;
    }
    if (control.invalid && (control.dirty || control.touched)) {
      return control.getError('issue') as string;
    }
    return null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // submit() emits only when the save succeeded; errors stay in the form and keep the drawer open.
    this.facade.submit().subscribe(() => this.close());
  }

  /** Cancel, the close button, Esc, the mask and a successful save all end up here — emit once. */
  protected close(): void {
    if (!this.$visible()) {
      return;
    }
    this.$visible.set(false);
    this.closed.emit();
  }
}
