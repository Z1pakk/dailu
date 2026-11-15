# Habit schedule implementation guide

A step-by-step guide for finishing the **schedule** part of habits: Daily / Weekly / Monthly
with optionally picked weekdays or days of the month (or "N times" when no days are picked),
"any time" vs. "at a specific time", and an optional duration.

The habit drawer already shows most of these controls, but they're disabled with "Coming soon"
tooltips (`habit-drawer.html`, section *2 Schedule*). The backend only stores
`Frequency { Type, TimesPerPeriod }`, so the frontend fakes "Weekdays" as `weekly × 5`
(`habit-schedule.ts`) and treats every habit as an any-time habit (`habit-today.ts`,
`dashboard-day.ts → clockHabits`). This guide replaces those workarounds with real data.

**Design:** Figma file `K1zOBnszjc5BjpEOllDfnf`, section *App · Habits*, frame
**"Spec · Schedule states · Daily / Weekly / Monthly + optional days"** (node `219:10981`).
It has one card per state below.

You implement it yourself, phase by phase. Each phase ends with a **Verify** step. Do it,
commit, then move on, because later phases assume the earlier ones work.

| Phase | File | What you end up with |
|---|---|---|
| 1 | [01-domain.md](01-domain.md) | `Frequency` = type + optional weekdays / month days, and `TimesPerPeriod` only for habits without days; a new `Timing` value object for time of day and duration; `IsScheduledOn(day)`; unit tests |
| 2 | [02-persistence-api.md](02-persistence-api.md) | Four new columns (old habits are deleted, not converted; `times_per_period` kept for "N times" habits), create/update/get habit carry the new fields, `openapi.json` regenerated |
| 3 | [03-frontend-model.md](03-frontend-model.md) | Frontend models, `isScheduledOn` mirrored from the domain, and "due today", the any-time lane, the dashboard clock, streaks and the heatmap all using the real schedule |
| 4 | [04-drawer.md](04-drawer.md) | The drawer's Daily / Weekly / Monthly switch, weekday buttons, month-day grid, "times per week/month" stepper, time mode, time picker and duration work and save |
| — | [05-later.md](05-later.md) | Deliberately left out: "repeat every N", user time zone, reminders, automation time windows |

---

## The whole model in one table

| Type | Days picked | No days picked |
|---|---|---|
| **Daily** | (there are no days to pick) | every day |
| **Weekly** | due on those weekdays; can have a time | **N times a week** (default 1), any days; no time |
| **Monthly** | due on those days of the month; can have a time | **N times a month** (default 1), any days; no time |

Plus, independently: **timing** (any time, or at `HH:mm`) and an optional **duration**.

## What the user can express

| User says | Stored as |
|---|---|
| "Every day" | `Daily` |
| "Drink 8 glasses of water a day" | `Daily`, measurable target "at least 8 glasses" (the existing `Target`, not a schedule thing) |
| "Weekdays" | `Weekly`, days Mon–Fri |
| "Mon, Wed, Fri at 07:00 for 45 min" | `Weekly`, days Mon/Wed/Fri, at 07:00, 45 min |
| "Once a week, whenever" | `Weekly`, no days (times = 1) |
| "Read 2× a week for 30 min, any days" | `Weekly`, no days, times = 2, no time, 30 min |
| "Pay rent on the 1st at 10:00" | `Monthly`, day 1, at 10:00 |
| "Review on the 15th and the last day" | `Monthly`, days 15 and 31 (31 = last day of a shorter month) |
| "Once a month, whenever" | `Monthly`, no days (times = 1) |
| "Deep-clean 3× a month" | `Monthly`, no days, times = 3 |
| "Read 30 min, any time" | `Daily`, no time, 30 min |

What you **can't** express, on purpose: "every other day", "every 2nd week", and "N times a
day" (that's a measurable target: "at least 3 times"). See [05-later.md](05-later.md) for
"repeat every N".

## How it fits together

```
 Habit (aggregate)
 ├─ Frequency   Type        Daily | Weekly | Monthly          (exists)
 │              WeekDays    set of DayOfWeek, Weekly only      (new)
 │              MonthDays   set of 1–31, Monthly only          (new)
 │              TimesPerPeriod  1 by default; > 1 only without days (exists, now restricted)
 ├─ EndDate                                                    (exists)
 └─ Timing      At          TimeOnly?  null = any time         (new)
                DurationMinutes int?   null = no duration      (new)

 IsScheduledOn(day)  ──  "could this habit be done on that calendar day?"
     domain (C#, unit-tested)  ═══ mirrored ═══  habit-schedule.ts (TS, spec-tested)
                                                     │
                     ┌───────────────────────────────┼────────────────────────────┐
              isDueToday / any-time lane      dashboard clock (timed)     streaks / heatmap / week
```

## Concepts in one paragraph each

- **Scheduled vs. due.** *Scheduled on a day* is pure calendar. A Mon/Wed/Fri habit is
  scheduled on Wednesday and not on Tuesday. "Once a week" is scheduled on every day of the week.
  *Due* adds progress: "2× a week" stops being due once it has two entries that week. The domain
  owns *scheduled*. *Due* stays in the frontend, where the entries are (today's `isDueToday`).
- **Fixed vs. flexible habits.** Daily, Weekly with weekdays, and Monthly with month days happen
  on known days, so they can have a time and sit on the clock. Weekly or Monthly with no days has
  no known day, just a count ("2× a week"). It never gets a time; it sits in the any-time lane
  until it has been done N times in the period.
- **Timing is wall-clock time.** "07:00" means 07:00 wherever the user is, not a UTC instant.
  It's stored as `TimeOnly` and interpreted in the browser's local time, like `localDay` already
  does for dates. There's no per-user time zone yet; see [05-later.md](05-later.md).
- **Duration is independent of time.** "Read 30 min" has a duration but no time. A duration
  with a time draws a segment on the clock. Without a time, it's just a label.
- **Amounts are not schedule.** "8 glasses" or "5 km" is the existing measurable `Target`
  ("At least" in the drawer). The schedule's "times" number only counts **sessions per week or
  month** for habits without picked days. Picked days already say how many sessions there are.

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| `FrequencyType` | **Kept**: Daily / Weekly / Monthly is the period | Without it, "once a week, any day" and monthly habits can't be expressed; with it, every type has the same "pick days or don't" shape |
| `TimesPerPeriod` | **Kept, only for Weekly/Monthly without days**: 1–7 a week, 1–31 a month; always 1 otherwise | "Read 2× a week, any days" is common. With picked days or Daily the number would conflict with the days, so it's fixed at 1 there. Per-day amounts belong to `Target` |
| "Repeat every N" / start date | **Not added** | Rare ("every other day"); it would need a start-date anchor and extra rules in every layer |
| Where the rule lives | **Domain owns `IsScheduledOn`; the frontend mirrors it** | No backend consumer yet, but reminders, the AI coach and server-side streaks will need it. Writing it once in C# with tests pins the semantics down before the TS copy |
| Days storage | **Two bitmask `int` columns**: `frequency_week_days` (`[Flags] WeekDays`, 7 bits) and `frequency_month_days` (`MonthDays`, bit *d−1* = day *d*, 31 bits) | One column each, cheap to compare, no join table; 0 means "no days picked". Separate, so a number never means two things |
| Days on the wire | **`weekDays: int[]` of `DayOfWeek` (0 = Sunday … 6 = Saturday); `monthDays: int[]` of 1–31** | Week numbering is the same in .NET `DayOfWeek`, JS `Date.getDay()` and date-fns `getDay` |
| Day 29–31 in shorter months | **Falls on the month's last day** (31 = "last day"), and the drawer **says so** with an info message whenever 29–31 is picked | That's what people mean by "the 31st"; the alternative silently skips months. The message keeps it from being a hidden rule |
| Timing column shape | **Required owned type with nullable columns** (`timing_at`, `timing_duration_minutes`) | An *optional* owned type whose columns are all null is ambiguous in EF; a required "empty" one isn't |
| Time allowed on | **Fixed-day habits only** (Daily, or Weekly/Monthly with days) | Only those have known days |
| Duration limits | **1–1440 minutes; `At + Duration` must not pass midnight** | The clock is one day; no overnight segments |
| "Weekdays" | **No longer a mode, just Mon–Fri picked under Weekly** | One way to express it |
| Existing habits | **Deleted by hand, not migrated** | Only test data exists; a conversion would have to guess what `weekly × 5` meant. Phase 2 keeps an optional conversion for later |

**Decision** lines inside the phases are choices you can change without breaking later phases.

## Prerequisites

- The habit module as it is today: `HabitAggregate`, `Frequency`, `CreateHabitCommand`,
  `UpdateHabitCommand`, `GetHabitsQuery`, `HabitEntityConfiguration`.
- The frontend habit libs: `habit-schedule.ts`, `habit-today.ts`, `habit-form-mapping.ts`,
  `dashboard-day.ts`, and their specs.

## Conventions used in this guide

- Paths are relative to `Dailu/`.
- Code follows the existing patterns: value objects with private setters and a
  `static Result<T> Create(...)`, aggregate create/restore/update request records, snake_case
  columns, numeric enums on the wire.
- Snippets are **sketches** that show shape and intent; they are not meant to compile as-is.
- Application models: `Models/Request/…RequestModel` for command input,
  `Models/Response/…ResponseModel` for query output, plain `Models/…Model` for services and
  cross-module contracts (phase 2, step 2.3).
- Tests: domain rules in `Habit.UnitTests` (xUnit + Shouldly); frontend only `lib/` logic specs,
  no component specs.
