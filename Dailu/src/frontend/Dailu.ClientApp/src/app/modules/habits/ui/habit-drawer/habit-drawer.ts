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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { githubEventTypeSelectItems } from '@habits/enums/github-event-type.enum';
import { stravaActivityTypeSelectItems } from '@habits/enums/strava-activity-type.enum';
import { googleHealthMetricSelectItems } from '@habits/enums/google-health-metric.enum';
import { ScheduleMode } from '@habits/lib/habit-schedule';
import { HabitDrawerFacadeService } from '@habits/ui/habit-drawer/habit-drawer-facade.service';
import { HabitDrawerFormControls } from '@habits/ui/habit-drawer/habit-drawer-form.type';
import { TagGetTags } from '@tags/state/tag.action';
import { UserProfileGetIntegrationConfigs } from '@user-profile/state/user-profile.action';

interface SourceCard {
  value: AutomationSource;
  name: string;
  hint: string;
}

const MOBILE_QUERY = '(max-width: 767.98px)';

/** New / Edit habit drawer (Figma `69:3615`, full content `70:4165`, mobile `69:3757`). */
@Component({
  selector: 'app-habit-drawer',
  imports: [
    ReactiveFormsModule,
    FormsModule,
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

  protected readonly scheduleOptions: { label: string; value: ScheduleMode }[] = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekdays', value: 'weekdays' },
    { label: 'Custom', value: 'custom' },
  ];
  protected readonly periodOptions = [
    { label: 'Per day', value: frequencyTypes.daily },
    { label: 'Per week', value: frequencyTypes.weekly },
    { label: 'Per month', value: frequencyTypes.monthly },
  ];
  protected readonly weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  /** "At a time" needs habit times in the backend; only "Any time" can be saved for now. */
  protected readonly timeModes = [
    { label: 'At a time', value: 'at', disabled: true },
    { label: 'Any time', value: 'any', disabled: false },
  ];

  protected readonly sourceCards: SourceCard[] = [
    { value: automationSources.none, name: 'Manual', hint: 'tick it yourself' },
    { value: automationSources.github, name: 'GitHub', hint: 'commits & PRs' },
    { value: automationSources.strava, name: 'Strava', hint: 'runs & rides' },
    { value: automationSources.googleHealth, name: 'Google Health', hint: 'steps & exercise' },
  ];

  protected readonly githubEventItems = githubEventTypeSelectItems;
  protected readonly stravaActivityItems = stravaActivityTypeSelectItems;
  protected readonly googleHealthMetricItems = googleHealthMetricSelectItems;

  private readonly _$scheduleMode = signal<ScheduleMode>('daily');
  protected readonly $scheduleMode = this._$scheduleMode.asReadonly();

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
    this._store.dispatch([new TagGetTags(), new UserProfileGetIntegrationConfigs()]);

    const media = window.matchMedia(MOBILE_QUERY);
    const onChange = (event: MediaQueryListEvent) => this.$isMobile.set(event.matches);
    media.addEventListener('change', onChange);
    this._destroyRef.onDestroy(() => media.removeEventListener('change', onChange));
  }

  ngOnInit(): void {
    this.facade.init(this.$habit());
    this._$scheduleMode.set(this.controls.scheduleMode.value);
    this._$tagIds.set(this.controls.tagIds.value);
    this.controls.scheduleMode.valueChanges.subscribe((mode) => this._$scheduleMode.set(mode));
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
