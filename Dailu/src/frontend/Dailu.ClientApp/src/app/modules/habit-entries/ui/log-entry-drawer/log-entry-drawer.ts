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
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngxs/store';
import { Drawer } from 'primeng/drawer';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { SelectButton } from 'primeng/selectbutton';
import { DatePicker } from 'primeng/datepicker';
import { Message } from 'primeng/message';
import { HabitGetHabits } from '@habits/state/habit.action';
import { frequencyTypes } from '@habits/enums/frequency-type.enum';
import { DayMode } from '@habit-entries/lib/log-entry';
import { LogEntryFacadeService, LogEntryPrefill } from '@habit-entries/ui/log-entry-drawer/log-entry-facade.service';
import { PercentPositionDirective } from '@shared/directives/percent-position.directive';

const MOBILE_QUERY = '(max-width: 767.98px)';

/** Log entry drawer (Figma "Spec · Log entry panel" · full content / mobile). */
@Component({
  selector: 'app-log-entry-drawer',
  imports: [ReactiveFormsModule, Drawer, Button, InputText, InputNumber, SelectButton, DatePicker, Message, PercentPositionDirective],
  providers: [LogEntryFacadeService],
  templateUrl: './log-entry-drawer.html',
  styleUrl: './log-entry-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogEntryDrawer implements OnInit {
  private readonly _destroyRef = inject(DestroyRef);
  protected readonly facade = inject(LogEntryFacadeService);

  public readonly $prefill = input<LogEntryPrefill>({}, { alias: 'prefill' });
  public readonly closed = output<void>();

  protected readonly form = this.facade.form;
  protected readonly controls = this.form.controls;
  protected readonly maxDate = new Date();
  protected readonly dayOptions: { label: string; value: DayMode }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Pick a date', value: 'pick' },
  ];

  protected readonly $visible = signal(true);
  protected readonly $isMobile = signal(window.matchMedia(MOBILE_QUERY).matches);
  protected readonly $dayMode = toSignal(this.controls.dayMode.valueChanges, { initialValue: this.controls.dayMode.value });

  /** "Read a book counts 1 chapter a day." */
  protected readonly $amountLead = computed(() => {
    const habit = this.facade.$habit();
    return habit ? `${habit.name} counts ${habit.target.value} ${habit.target.unit} a ${this._period()}.` : '';
  });
  protected readonly $amountLabel = computed(() => {
    const unit = this.facade.$habit()?.target.unit ?? '';
    return unit ? unit.charAt(0).toUpperCase() + unit.slice(1) : 'Amount';
  });
  /** Amount is section 3 only for measurable habits; Note moves up otherwise. */
  protected readonly $noteNumber = computed(() => (this.facade.$isMeasurable() ? 4 : 3));

  constructor() {
    inject(Store).dispatch(new HabitGetHabits());
    const media = window.matchMedia(MOBILE_QUERY);
    const onChange = (event: MediaQueryListEvent) => this.$isMobile.set(event.matches);
    media.addEventListener('change', onChange);
    this._destroyRef.onDestroy(() => media.removeEventListener('change', onChange));
  }

  ngOnInit(): void {
    this.facade.init(this.$prefill());
  }

  protected pick(habitId: string): void {
    this.controls.habitId.setValue(habitId);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // submit() emits only when the save succeeded; errors stay in the form.
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

  private _period(): string {
    const type = this.facade.$habit()?.frequency.type;
    if (type === frequencyTypes.weekly) {
      return 'week';
    }
    return type === frequencyTypes.monthly ? 'month' : 'day';
  }
}
