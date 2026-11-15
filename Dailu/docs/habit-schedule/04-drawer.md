# Phase 4: the habit drawer

Goal: the drawer's **2 Schedule** section matches the Figma spec
**"Spec · Schedule states · Daily / Weekly / Monthly + optional days"** (file
`K1zOBnszjc5BjpEOllDfnf`, node `219:10981`), and every control saves.

Files: `habits/ui/habit-drawer/habit-drawer.{html,ts,scss}`, `habit-drawer-facade.service.ts`,
`habits/lib/habit-form-mapping.ts`, `habits/schemas/habit.schemas.ts`.

**Status: done** (steps 4.1–4.5). Implementation notes:

- `habit-form-mapping.ts` exports `frequencyOf(value)` and `timingOf(value, frequency)`; the
  facade uses them for its live signals, so the hints, the clock strip and the saved request
  always agree.
- `habit-schedule.ts` gained `maxTimesPerPeriod(type)` (7 / 31 / 1) and `clockSpan(timing)`
  (start/end minutes, 30-min default slot), shared by the drawer strip and the dashboard clock.
- The facade normalises on every period change (`frequencyType.valueChanges`), so choosing a
  period in the select button and calling `setFrequencyType` behave the same.
- Not checked in a browser yet: open the drawer and walk through the Figma states (Verify below).

```
Schedule section (Figma states, left to right)
 [Daily | Weekly | Monthly]                 period select button (was Daily | Weekdays | Custom)
   Daily   → no day picker; hint: amounts go in "At least"
   Weekly  → M T W T F S S                  empty = N times a week, any days
   Monthly → 1–31 grid (7 per row)          empty = N times a month, any days
   no days picked → [− 2 +] times a week     "Times per week/month" stepper (new)
 hint line: what the picked days (or the count) mean
   + Message · Info when 29–31 is picked: "Not every month has a 31st… moves to the last day"
 [At a time | Any time]                     "At a time" disabled (40 %) when no days are picked
   At a time → Start time · Duration
   Any time  → Duration only
 hint line: "07:00–07:45 · on your clock" / "Pick days to set a time"
```

What goes away: the "Custom" row (Repeat select + Times input) and the "Weekdays" mode, since
Weekdays is now just Mon–Fri picked under Weekly. The Times input comes back as the stepper,
shown only when Weekly or Monthly has no days picked.

---

## Step 4.1: Drawer form value (`habit-form-mapping.ts`)

`HabitDrawerValue` changes:

| Remove | Add | Empty default |
|---|---|---|
| `scheduleMode`, `customFrequencyType` | `frequencyType: FrequencyType` | `daily` |
| | `weekDays: number[]` | `[]` |
| | `monthDays: number[]` | `[]` |
| `customTimesPerPeriod` | `timesPerPeriod: number` (renamed) | `1` |
| | `timeMode: 'any' \| 'at'` | `'any'` |
| | `at: Date \| null` (what the time picker binds to) | `null` |
| | `durationMinutes: number \| null` | `null` |

- `drawerValueFromHabit`: copy the type, days and `timesPerPeriod`;
  `timeMode = habit.timing.at ? 'at' : 'any'`;
  `at = timeOfDayToDate(habit.timing.at)` (from `@shared/lib/date/time-of-day.ts`).
- `toHabitRequest`:
  - `frequency`: `{ type, weekDays: type === weekly ? weekDays : [], monthDays: type === monthly ? monthDays : [] }`.
    Only the current type's days are sent, so a stale selection can never leak.
  - `frequency.timesPerPeriod`: the form value when `!hasFixedDays(frequency)`, otherwise `1`.
    Same idea: a count left over from "no days" never reaches a fixed-day habit.
  - `timing.at`: `dateToTimeOfDay(value.at)` only when `timeMode === 'at'` **and**
    `hasFixedDays(frequency)`, otherwise `null`.
  - `timing.durationMinutes`: as is.
- Remove the phase 3 stop-gap: `ScheduleMode`, `scheduleModeOf`, `frequencyFor` and `timingFor`
  in this file, and the `ScheduleMode` import in `habit-drawer.ts`. The form owns the type, days,
  count and timing now.

Keep this mapping pure. It's what the spec tests (step 4.5).

---

## Step 4.2: Validation (`habit.schemas.ts` + form)

New valibot schemas in the existing style:

- `HabitWeekDaysSchema`: an array of integers 0–6.
- `HabitMonthDaysSchema`: an array of integers 1–31.
- `HabitDurationSchema`: nullable, an integer from 1 to 1440.
- `HabitAtSchema`: a nullable `Date`.
- `HabitFrequencyTimesPerPeriodSchema` (exists): an integer from 1 to 7 for Weekly and 1 to 31
  for Monthly. The limit depends on the type, so either build the schema from the type or check
  the upper bound in the form-level validator below.

Form-level validator, mirroring the domain so the user sees the error before the API does:

- `timeMode === 'at'` requires `at`;
- `at + duration` doesn't pass midnight;
- `timesPerPeriod` is within 1–7 (Weekly) or 1–31 (Monthly) when no days are picked.

---

## Step 4.3: Template and component (`habit-drawer.html/.ts`)

Top to bottom through section 2. Delete each "Coming soon" tooltip and "isn't stored yet"
comment as you go.

1. **Period select button.** Options become `Daily / Weekly / Monthly`, bound to
   `frequencyType`. Remove `scheduleOptions`, `periodOptions` and the whole Custom row.
2. **Weekday buttons** (Weekly only; hidden for Daily and Monthly). Remove `[disabled]`.
   Loop over `weekButtonOrder` from `day-of-week.enum.ts` (Monday first) and delete the
   component's `weekdays = ['M', 'T', …]` array. The label is the first letter of
   `dayOfWeekShortLabels[day]`, `is-selected` is `weekDays.includes(day)`, and a click calls
   `facade.toggleWeekDay(day)`.
3. **Month-day grid** (Monthly only; new). Use the same `.day` toggle style, 7 per row, days
   1–31. A click calls `facade.toggleMonthDay(day)`.
4. **Times stepper** (new), only for Weekly or Monthly with **no** days picked, directly under the
   day picker. Use `p-inputnumber` with `[showButtons]="true"` and `buttonLayout="horizontal"`,
   `[min]="1"` and `[max]` 7 or 31, bound to `timesPerPeriod`. The label reads
   *"Times per week"* or *"Times per month"*, with the suffix *"times a week"* / *"times a
   month"* next to it, as in Figma. Reuse the existing `customTimesPerPeriod` input and its
   error message, renamed.
5. **Days hint** under the picker, as in Figma:
   - Daily: *Every day · amounts go in "At least" below*
   - Weekly with days: *Mon, Wed, Fri · pick Mon–Fri for weekdays*; with none:
     *No days picked · once a week, any day*, or for N > 1 *No days picked · 2 times a week,
     any days*
   - Monthly with days: *1st, 15th and 31st of every month*; with none:
     *No days picked · once a month, any day*, or for N > 1 *No days picked · 3 times a month,
     any days*
   These strings come from `daysHint(frequency)` in `habit-schedule.ts` (phase 3).
   The template only binds the result.
   **Short-month warning.** When any of 29, 30 or 31 is picked, show the existing
   `Message` component (Severity = Info, the same one as the auto-check rule) under the hint.
   The text names the highest picked day:
   *"Not every month has a 31st. In those months this habit moves to the last day of the
   month — e.g. 30 Nov, 28 Feb."* For 30: *"…has a 30th…"*, example *28 Feb*. For 29: example
   *28 Feb (in non-leap years)*. The text comes from `shortMonthWarning(monthDays)` in
   `@habits/lib/month-days.ts` (phase 3); show the message when it isn't `null`. It's
   informational and never blocks saving.
6. **Day and period changes live in the facade** (`habit-drawer-facade.service.ts`), the only
   place that implements them:
   ```ts
   public toggleWeekDay(day: DayOfWeek): void;
   public toggleMonthDay(day: number): void;
   /** Switches period; clears the other period's days, and `at` if the result has no fixed days.
    *  Keeps timesPerPeriod but clamps it to the new maximum (31 → 7 going to Weekly); Daily → 1. */
   public setFrequencyType(type: FrequencyType): void;
   ```
   `toggleWeekDay` and `toggleMonthDay` also clear `at` when the last picked day is removed.
   Picking the first day resets `timesPerPeriod` to 1 (the stepper disappears).
7. **Time mode.** Bind the `p-selectbutton` to `timeMode` in the form instead of the
   standalone `[ngModel]="'any'"`. "At a time" is disabled when `!hasFixedDays`, with tooltip
   *"Pick days to set a time"*; Figma shows this at 40 % opacity.
8. **Time picker.** When `timeMode === 'at'`, show the "Start time" field as `p-datepicker` with
   `[timeOnly]="true"` and `[stepMinute]="15"`. **Decision:** 15-minute steps match the clock.
9. **Duration.** Fill the `p-select` with 5 min – 12 h
   (`5, 10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720`), labelled
   with `formatDuration`, plus the habit's own duration when it isn't in the list; clearable,
   placeholder "No duration". Bind it to `durationMinutes` and remove `[disabled]`. In Any-time mode it
   takes the full row (Figma).
10. **Time hint**, from `timeHint(frequency, timing)` in `habit-schedule.ts`:
   `07:00–07:45 · on your clock` when timed; `Pick days to set a time · due until done this
   week/month` for flexible habits (`… until done 2× this week` when N > 1); the existing
   `Due by midnight · not on your clock` for any-time fixed-day habits.

---

## Step 4.4: Clock preview at the top

The preview currently shows dummy "busy" segments from the sample day, with a "Sample schedule"
tooltip.

- Draw the user's **other timed habits** that are scheduled today as busy segments, using
  `clockHabits` from phase 3. The facade may already load habits; check before adding a request.
- Highlight the habit being edited when it has a time. Without a time, keep the "Any time today ·
  not on your clock" header.
- Delete `habits/lib/sample-day.ts` and its spec once nothing imports them.

---

## Step 4.5: Specs

No component specs. Cover the logic:

- `habit-form-mapping.spec.ts`:
  - Weekly + M/W/F → `{ type: weekly, weekDays: [1,3,5], monthDays: [] }`;
  - Monthly + 1, 15 → `{ type: monthly, weekDays: [], monthDays: [1,15] }`;
  - Weekly with stale `monthDays` in the form → `monthDays: []` in the request;
  - "At a time" with no days picked → `timing.at: null`;
  - Weekly, no days, times 3 → `timesPerPeriod: 3`; Weekly [Mon] with a stale times 3 →
    `timesPerPeriod: 1`;
  - edit round-trip: `drawerValueFromHabit` → `toHabitRequest` returns the same schedule.
- `habit-schedule.spec.ts`: `daysHint` and `timeHint` strings, including the "2 times a week"
  variants.
- `month-days.spec.ts`: `shortMonthWarning` returns `null` for
  `[1, 15]`, the "31st" text for `[1, 31]`, the "30th" text for `[30]`, and the 31st text for
  `[29, 30, 31]` (highest day wins).
- `habit-drawer-facade.service.spec.ts`: `toggleWeekDay` adds and removes; Weekly [Tue] →
  `setFrequencyType(monthly)` → no weekdays; Weekly [Mon] at 07:00 → remove Mon → `at` cleared;
  Monthly no days × 20 → `setFrequencyType(weekly)` → times 7; Weekly × 3 → pick Tue → times 1.

---

## Verify

- In the running app, create each Figma state through the drawer, reopen it, and check it shows
  exactly what was saved.
- "At a time" is disabled for Weekly and Monthly with no days, and turns on as soon as a day is
  picked.
- The times stepper shows only for Weekly/Monthly with no days, stops at 7 for Weekly and 31 for
  Monthly, and "Read · 2× a week · 30 min" reopens with the stepper at 2.
- 23:30 + 45 min shows an error before saving.
- The clock preview shows other timed habits and the edited one in place.
- `grep -rn "Coming soon\|coming soon\|isn't stored yet\|no time of day\|customTimesPerPeriod" src/frontend/Dailu.ClientApp/src/app/modules/habits`
  finds nothing.
