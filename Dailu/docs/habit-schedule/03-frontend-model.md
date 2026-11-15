# Phase 3: frontend model and schedule logic

Goal: everything that decides "does this habit count today?" uses the real schedule, and every
workaround comment ("habits have no time of day yet", "weekdays stored as weekly × 5") is gone.
The drawer UI comes in phase 4. Here it only has to keep saving correctly.

```
habit.model.ts (frequency { type, weekDays, monthDays, timesPerPeriod }, timing)
        │
habit-schedule.ts ── isScheduledOn(habit, day)   ← mirror of the domain's IsScheduledOn
        │            hasFixedDays, hasTime, scheduleLabel
        ├──► habit-today.ts     isDueToday, periodProgress, anyTimeLane (untimed only)
        ├──► dashboard-day.ts   per-day tracking, streaks, heatmap, week, clockHabits (real times)
        └──► habit-entries/lib  log-entry.ts (due / not-due), entry-feed.ts
```

All paths are under `src/frontend/Dailu.ClientApp/src/app/modules/`.

---

## Step 3.1: Models

**Done.** The model files below are already changed; this step describes them. The frontend keeps
**one** `FrequencyModel` and **one** `TimingModel` for both directions, unlike the backend's
request/response split (phase 2, step 2.3). The API always returns every field, and the frontend
always sends every field, so the backend's optional request fields never matter here.

- `habits/models/frequency.model.ts`:
  `{ type: FrequencyType; weekDays: DayOfWeek[]; monthDays: number[]; timesPerPeriod: number }`.
  **`timesPerPeriod` stays**, but it only means something for weekly/monthly habits with no days;
  it's always 1 otherwise.
- `habits/models/timing.model.ts` (new): `{ at: string | null; durationMinutes: number | null }`.
  `at` stays the wire string `"HH:mm:ss"`; the helpers below convert it.
- `habits/models/habit.model.ts`: `timing: TimingModel`.
- `habits/models/requests/create-habit.request.ts` and `update-habit.request.ts`:
  `timing: TimingModel`. Always send it, even as `{ at: null, durationMinutes: null }`: on update,
  a missing `timing` clears the habit's time (phase 2, step 2.4).
- `habits/enums/day-of-week.enum.ts` (new), the same shape as `frequency-type.enum.ts`. It's
  static data, so it gets no spec:
  - `daysOfWeek` (`sunday: 0` … `saturday: 6`, the .NET/`Date.getDay()` numbering) and
    `DayOfWeek`;
  - `dayOfWeekShortLabels` (`Sun` … `Sat`);
  - `weekButtonOrder` (Monday first, for the drawer);
  - `workWeek` (Mon–Fri, for `isWeekdays`).
- `habits/schemas/habit.schemas.ts`: keep `HabitFrequencyTimesPerPeriodSchema`; phase 4 gives it
  the 1–7 / 1–31 limits.

**What the model change breaks** (`npx tsc --noEmit -p tsconfig.app.json` /
`tsconfig.spec.json`). This is the to-do list for the rest of this phase:

| File | Why | Fixed in |
|---|---|---|
| `habits/lib/habit-schedule.ts` | `frequencyFor` builds a `FrequencyModel` without days | step 3.2 (rewrite) |
| `habits/lib/habit-form-mapping.ts` | the request has no `timing`; the frequency has no days | step 3.7 |
| about 14 `*.spec.ts` files | test habits built with `{ type, timesPerPeriod }` and no `timing` | step 3.6 (fixtures) |

Places that **read** `timesPerPeriod` still compile. Search for them: each one must treat it as
the count only when `!hasFixedDays(frequency)`, and as 1 otherwise.

### Time helpers: `@shared/lib/date/`

**Done**, with specs (`time-of-day.spec.ts`, `format-duration.spec.ts`).

They're not about habits, so they sit next to `local-day.ts`, one topic per file.

`time-of-day.ts` (new) converts between the three time shapes: the wire `"HH:mm:ss"`, minutes for
the clock, and a `Date` for the picker:

```ts
/** "07:30:00" → 450 */
export function timeOfDayToMinutes(value: string): number;
/** 450 → "07:30" (display) */
export function formatTimeOfDay(minutes: number): string;
/** Picker Date → "07:30:00" (wire). Seconds are dropped. */
export function dateToTimeOfDay(date: Date): string;
/** "07:30:00" → a Date on `day` (default: today) at 07:30, for the time picker. */
export function timeOfDayToDate(value: string, day?: Date): Date;
```

`format-duration.ts` (moved): move `formatDuration(minutes): string` out of
`habits/lib/habit-today.ts` unchanged, and update its imports (`habit-today.ts`,
`log-entry-facade.service.ts`). The drawer's duration select and `scheduleLabel` need it too.

---

## Step 3.2: `habit-schedule.ts`

**Done.** `month-days.ts` and the rewritten `habit-schedule.ts` exist, with specs
(`month-days.spec.ts`, `habit-schedule.spec.ts`). The callers of `scheduleLabel` (`log-entry.ts`,
`habit-list.ts`) now pass the habit. The list adds " · any time" only to untimed habits.

Port phase 1's `IsScheduledOn` **line for line**:

```
isScheduledOn(habit, day):           // day = 'yyyy-MM-dd', like localDay output
  if day < localDay(habit.createdAtUtc)          → false
  if habit.endDate and day > habit.endDate       → false
  if archived or completed                       → false
  daily   → true
  weekly  → weekDays empty  or weekDays includes getDay(day)
  monthly → monthDays empty or matchesMonthDay(monthDays, day)
```

### Month-day helpers: `@habits/lib/month-days.ts` (new)

The TS twin of the domain's `MonthDays`, working on plain `number[]` (the API shape). It gets its
own file because both the schedule rule and the drawer text use it:

```ts
/** Same rule as MonthDays.Matches. `day` is 'yyyy-MM-dd', like localDay output. */
export function matchesMonthDay(monthDays: readonly number[], day: string): boolean;
/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd", 31 → "31st" */
export function ordinalDay(day: number): string;
/** [1, 15, 31] → "1st, 15th and 31st" */
export function formatMonthDays(monthDays: readonly number[]): string;
/** null unless 29–31 is picked; the text names the highest picked day (phase 4, step 4.3). */
export function shortMonthWarning(monthDays: readonly number[]): string | null;
```

`matchesMonthDay` uses `getDaysInMonth` from date-fns and the same "highest picked day past the
end" check as the C# version.

### Schedule rules: `@habits/lib/habit-schedule.ts` (rewritten)

```ts
/** Daily, or weekly/monthly with picked days. */
export function hasFixedDays(frequency: FrequencyModel): boolean;
/** Sessions needed per week/month: timesPerPeriod for flexible habits, 1 for fixed-day ones. */
export function timesPerPeriod(frequency: FrequencyModel): number;
export function hasTime(habit: HabitModel): boolean;                  // habit.timing.at !== null
/** Weekly and exactly workWeek (Mon–Fri). */
export function isWeekdays(frequency: FrequencyModel): boolean;
/** Mirror of Frequency.Matches: the calendar part only (no creation, end date or status). */
export function matchesDay(frequency: FrequencyModel, day: string): boolean;
/** Mirror of HabitAggregate.IsScheduledOn (above). */
export function isScheduledOn(habit: HabitModel, day: string): boolean;
/** List / card label, e.g. "Mon, Wed, Fri · 07:00 · 45 min". Takes the habit because it shows timing. */
export function scheduleLabel(habit: HabitModel): string;
/** Drawer hint under the day picker (phase 4, step 4.3). */
export function daysHint(frequency: FrequencyModel): string;
/** Drawer hint under the time controls (phase 4, step 4.3). */
export function timeHint(frequency: FrequencyModel, timing: TimingModel): string;
```

**Remove** `ScheduleMode`, `scheduleModeOf`, `frequencyFor` and `WEEKDAYS_PER_WEEK` from this
file. `WEEKDAYS_PER_WEEK` is gone; the other three moved to `habit-form-mapping.ts` as the step 3.7
stop-gap, because the drawer still offers Daily / Weekdays / Custom until phase 4 deletes them. `scheduleLabel` used to take only the
frequency, so update its callers (the habit list cards).

`habit-today.ts` and `dashboard-day.ts` keep their exported names. They import these rules
instead of adding their own.

`scheduleLabel` spec examples:
  - `Daily` · `Weekdays` · `Mon, Wed, Fri` · `Weekly` (no days, × 1) · `2× a week` ·
    `Monthly · 1st, 15th` · `Monthly · last day` (31) · `Monthly` (no days, × 1) ·
    `3× a month`
  - with timing, append ` · 07:00` and/or ` · 45 min` via `formatTimeOfDay` and
  `formatDuration`.

**Spec (`habit-schedule.spec.ts`):** copy phase 1's `IsScheduledOn` table, same dates and same
expectations. If C# and TS ever disagree, compare the two tables.

---

## Step 3.3: "Due today" (`habits/lib/habit-today.ts`)

**Done**, with the step 3.8 cases in `habit-today.spec.ts`.

`isDueToday(habit, entries, today)`:

```
if !isScheduledOn(habit, today)    → false
if hasFixedDays(habit.frequency)   → true                                        // scheduled today = due today
otherwise (weekly/monthly, no days) → entries before today in this week/month < N  // still shown on the day it was done
```

N is `timesPerPeriod(frequency)`. This is today's rule, now limited to habits without days.
Keep the period as the calendar week (Monday start) or month. Count **days with an entry**, not
entries, so logging twice on Monday doesn't finish a "2× a week" habit: the domain allows at most
one session a day (7 a week, 31 a month).

`periodProgress`:

- daily, or fixed days → `1` if there's an entry today, else `0`;
- no days → days with an entry in this week/month, capped at N, out of N (`1 / 2` for
  "2× a week" after one session).

`anyTimeLane`: only habits **without** a time (`!hasTime`). It also returns `markers` for the
lane's track (Figma `231:11011`): a ✓ marker where each done habit was ticked, with habits done
within ~45 min of each other grouped into one, and one marker at now for all open habits. Each
item carries `doneAt` and `doneBy` ("by you" or the integration) for the hover card. Timed habits move to the clock in
step 3.4. Update the header comment, which currently says "every real habit is an any-time
habit".

---

## Step 3.4: Dashboard (`dashboard/lib/dashboard-day.ts`)

**Done**, with tests in `dashboard-day.spec.ts`. Two things beyond the list below:

- **Free days in the full streak.** A day where nothing is scheduled (Tuesday when every habit
  is Mon/Wed/Fri) used to have a total of 0, so it counted as "not done" and broke the streak.
  `streaks` now treats such days as free: they neither count nor break a run.
- `TodayHabit` carries the habit's `timing`, so `clockHabits(todayHabits)` can place timed
  habits without a second lookup. The today list says "Nothing scheduled today." when empty.

This file has the biggest hidden assumption: `trackedHabits` = **daily habits only**, and every
day counts every tracked habit.

1. **Per-day tracking.** In `dayProgress`, replace `existedOn(habit, day)` with
   `isScheduledOn(habit, day)`. Widen `trackedHabits` to **fixed-day habits**: daily, weekly with
   days, monthly with days. A Mon/Wed/Fri habit then counts on Mon/Wed/Fri only and doesn't break
   the streak on Tuesday. Habits with no days stay out of the strict streak, as weekly and
   monthly habits are today.
   - `isFullyDone`, `streaks`, `dayCounts` and `currentWeek` go through `dayProgress` or
     `trackedHabits`, so they follow automatically.
   - `todayHabits` filters by `isScheduledOn(h, today)`.
   - `dashboard.ts → $habitsPerDay`: use today's count (`todayHabits(...).length`).
2. **Clock.** `clockHabits` currently spreads habits evenly from 06:00. New rule:
   - timed habits: `startMinutes = at`, `endMinutes = at + (durationMinutes ?? DEFAULT_SLOT)`.
     **Decision:** `DEFAULT_SLOT` = 30 min, so a time-only habit is still visible.
   - untimed habits are **not on the clock**. They're in the any-time lane.
   - `waitingLabel` for a timed manual habit: `at 07:00`, the format `day-clock.model.ts`
     already describes.
   - Re-read the `isDone` comment on `ClockHabit`. With real times, "next" and "scheduled" can
     come from the clock again for timed habits.
3. **Today card.** `today-card.ts` uses `sampleClockHabits()` (dummy data from
   `habits/lib/sample-day.ts`). Pass it the real `clockHabits(...)` instead.

---

## Step 3.5: Habit entries (`habit-entries/lib/`)

**Done.** `entry-feed.ts` uses `trackedHabits` for the "missed" rows and each day's done/total;
both now use `isScheduledOn` instead of "created before that day". A Mon/Wed/Fri habit is no
longer reported as missed on a Tuesday (covered in `entry-feed.spec.ts`).

- `log-entry.ts` calls `isDueToday`, so it follows automatically. Fix any fixture that builds
  "weekdays" as `weekly × 5`.
- `entry-feed.ts` uses `trackedHabits` (around line 135). Check what for. "Tracked that day"
  most likely should become `isScheduledOn`.

---

## Step 3.6: Streaks and tag cards

**Done.** Both use `matchesDay` (step 3.2) for "is this a scheduled day", and count **days with
an entry**, not entries, like `isDueToday`. Every spec builds habits with the new fields, and all
268 frontend tests pass.

Two more places use `timesPerPeriod` as "how many times per period". Both switch to "one per
scheduled day" for fixed-day habits, and keep the count (via `timesPerPeriod(frequency)`) for
habits without days.

**`habits/lib/habit-progress.ts` → `periodOf`** (used by `habitStreak` on the habit list):

| Schedule | `unit` | `counts(day)` | `previous(start)` | `needed` |
|---|---|---|---|---|
| fixed days (daily, weekly or monthly with days) | `day` | `isScheduledOn`'s frequency check for that day | step back to the previous scheduled day | `1` |
| weekly, no days | `week` | always | previous week | `timesPerPeriod` (N) |
| monthly, no days | `month` | always | previous month | `timesPerPeriod` (N) |

The current `isWeekdays` branch (skip weekends) becomes the fixed-days row, which covers any
picked days. Delete the special case. To keep `previous` from looping forever, it stops at the
habit's creation day.

**`tags/lib/tag-cards.ts` → `weekProgress`** (the tag card's "x / y this week"):

- fixed days: `expected` = the days of this week the habit is scheduled on (7 for daily, the
  number of picked weekdays, and for monthly the picked days that fall in this week).
  `done` = how many of those days have an entry.
- weekly, no days: `expected: N`, `done: min(days with an entry, N)`.
- monthly, no days: `{ done: 0, expected: 0 }`, the same as today.

Drop the `isWeekdays` branch. `times` stays for the weekly no-days row only.

**Spec fixtures.** About 15 spec files build habits with `frequency: { type, timesPerPeriod }`.
Add `weekDays: [], monthDays: []` to them, add `timing: { at: null, durationMinutes: null }`,
and rewrite each `weekly × 5` fixture as weekly with `[1, 2, 3, 4, 5]` and times 1.
- `weekly × 2`, `weekly × 3`, `monthly × 2`: keep them; they're "N times, any days" habits.
- `daily × 2`, `daily × 3`: that combination no longer exists, so delete those cases.

Specs for this step: `habit-progress.spec.ts` (a Mon/Wed/Fri streak skips Tuesday; a "2× a week"
streak counts a week only with two days done) and `tag-cards.spec.ts` (Mon/Wed/Fri gives
`expected: 3`; "2× a week" gives `expected: 2`).

---

## Step 3.7: Keep the drawer saving

**Done.** Phase 4 rebuilds the controls. Until then, `habit-form-mapping.ts` maps the drawer's
Daily / Weekdays / Custom choice onto the real schedule (`ScheduleMode`, `scheduleModeOf`,
`frequencyFor` and `timingFor` live there now):

- Daily → daily × 1; Weekdays → weekly with Mon–Fri × 1.
- Custom → the selected type with no days and the entered times, clamped to the API limits
  (1–7 a week, 1–31 a month, 1 for daily).
- **Days set through the API survive a save:** with Custom and the type unchanged, the stored
  weekdays or month days are sent back as they are.
- `timing` is the stored one (`{ at: null, durationMinutes: null }` for a new habit), so editing
  never wipes a time set through the API. The time is dropped, and the duration kept, only when
  the resulting schedule has no fixed days, because the API would reject it.

`habit-form-mapping.spec.ts` covers the round trips (Mon–Fri, weekly × 2, Mon/Wed/Fri at 07:00
for 45 min, monthly 1st and 15th, a duration-only habit), the clamping, a type change dropping
the API-picked days, and the time being dropped on a flexible schedule.

---

## Step 3.8: Specs

Only `lib/` logic, per the project rule:

- `habit-schedule.spec.ts`: the `isScheduledOn` table, the labels, `isWeekdays`,
  `timesPerPeriod` (1 for fixed days even if the field says otherwise).
- `month-days.spec.ts`: `matchesMonthDay` (the short-month rows of the table), `ordinalDay`
  (1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 31st), `formatMonthDays`.
- `@shared/lib/date/time-of-day.spec.ts`: round-trips between `"07:30:00"`, `450` and a `Date`;
  seconds dropped.
- `@shared/lib/date/format-duration.spec.ts`: move the existing cases from
  `habit-today.spec.ts`.
- `habit-today.spec.ts`: Mon/Wed/Fri not due on Tuesday; "1st and 15th" due only on those days;
  "31st" due on 30 November; "weekly, no days" not due after an entry on Monday; "2× a week"
  still due after one entry on Monday and not due after entries on Monday and Wednesday; two
  entries on the same Monday count once; `periodProgress` is `1 / 2` after one session; a timed
  habit is not in the any-time lane.
- `dashboard-day.spec.ts`: a Mon/Wed/Fri habit doesn't break the streak on Tuesday; a 07:00–07:45
  clock segment; an untimed habit is not on the clock.
- `habit-form-mapping.spec.ts`: "Weekdays" round-trips as Mon–Fri; editing keeps `timing`.

---

## Verify

- `npm test` and `npm run build` are clean.
- With the phase 2 API, create through the API a Mon/Wed/Fri at 07:00 for 45 min habit, a
  "Monthly, days 1 and 15" habit and a "Weekly, no days, × 2, 30 min" habit. Then on the
  dashboard:
  - on a Tuesday, the weekly habit isn't in today's list, the lane or the week strip, and the
    streak doesn't break;
  - on a Wednesday, it's a 07:00–07:45 segment on the clock and not in the any-time lane;
  - the monthly habit shows up only on the 1st and the 15th;
  - the "2× a week" habit stays in the any-time lane after one session that week, and leaves it
    after the second.
- Opening and saving an old habit in the drawer leaves its schedule unchanged. Check the `PUT`
  body.
- `grep -rn "no time of day yet\|weekly × 5" src/frontend` finds nothing, and every remaining
  `timesPerPeriod` read goes through `timesPerPeriod(frequency)` or is in the drawer, which
  phase 4 fixes.
