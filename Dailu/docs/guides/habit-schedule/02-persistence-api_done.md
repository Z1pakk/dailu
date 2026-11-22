# ✓ Phase 2: persistence and API

Goal: the new schedule fields are stored (four new columns, old habits are deleted rather than
converted), `times_per_period` is kept but only means "N times" for habits without days, and `POST /habits`, `PUT /habits/{id}` and
`GET /habits` carry the new shape.

```
CreateHabitCommand / UpdateHabitCommand          GetHabitsQuery
  FrequencyRequestModel { type, weekDays?[],        HabitModel { …, frequency: FrequencyResponseModel
    monthDays?[], timesPerPeriod = 1 }                  { type, weekDays[], monthDays[], timesPerPeriod },
  TimingRequestModel?                                   timing: TimingResponseModel { at, durationMinutes } }
          │                                                ▲
          ▼                                                │
   HabitAggregate (phase 1) ──► HabitEntity ──► habits.habits (+4 columns)
```

---

## Step 2.1: Entity and EF configuration

`Habit.Domain/Entities/HabitEntity.cs` already has `public required Timing Timing { get; set; }`,
and `ToEntity()` copies it (done in phase 1). `Frequency` already changed in phase 1 too. Only
the EF configuration is left:

`Habit.Infrastructure/Database/Configurations/HabitEntityConfiguration.cs`:

Today it has `builder.OwnsOne(h => h.Frequency);` with no configuration. Replace it with the
form that takes a lambda, and add `Timing` next to it:

```csharp
builder.OwnsOne(
    h => h.Frequency,
    frequency =>
    {
        frequency
            .Property(f => f.MonthDays)
            .HasConversion(v => v.Bits, bits => MonthDays.FromBits(bits));
    }
);

builder.OwnsOne(h => h.Timing);
builder.Navigation(h => h.Timing).IsRequired();
```

- `frequency_type` and `frequency_times_per_period` stay as they are.
- `WeekDays` is an enum, so it maps to `int` on its own and becomes `frequency_week_days`.
- `MonthDays` is a struct, so it needs the value converter. Write it inline; it doesn't need a
  helper class. It has value equality (`record struct`), so it doesn't need a value comparer
  either.
- **No `HasColumnName`:** the snake_case naming convention already produces
  `frequency_week_days`, `frequency_month_days`, `timing_at` and `timing_duration_minutes`, the
  same way it produces `frequency_times_per_period`.
- **No `HasDefaultValue`:** `MonthDays.None` and `WeekDays.None` are the types' default values.
  EF warns about a database default equal to the CLR default, because it can't tell "not set"
  from "0". The migration gives the new non-nullable columns `defaultValue: 0` on its own, which
  fills existing rows.
- **The navigation must be required.** This is the "required owned type with nullable columns"
  decision. Without `IsRequired()`, EF reads a row whose timing columns are both null back as
  `Timing == null`.

---

## Step 2.2: Migration

From `src/modules/habit/Habit.Infrastructure`:

```
dotnet ef migrations add Habit_AdjustSchedule
```

**Keep the migration as EF generates it.** `TimesPerPeriod` is still mapped, so EF only adds the
four new columns, and `Down()` drops them:

- `frequency_week_days` and `frequency_month_days`: `integer`, not null, default `0`;
- `timing_at` (`time without time zone`) and `timing_duration_minutes` (`integer`): nullable.

Every change is additive. Existing rows get no days, times unchanged, and any time.

**Decision: old habits are deleted, not converted.** Rows saved before this change can break the
new rules: "Weekdays" was stored as `Weekly × 5`, and `Daily × N` is no longer allowed. Instead of
converting them, delete them in the app before relying on the new schedule. Until then:

- they still load, and `GET /habits` returns them with no days. After phase 3 the frontend reads
  `Weekly × 5` as "5 times a week, any days";
- editing an invalid one (`Daily × 3`) returns a 400; deleting it works;
- deleting is a soft delete: the row stays with `is_deleted = true` and is hidden from every
  query, so it can't cause problems later. Its entries stay, as for any deleted habit.

See `docs/guides/ci-migrations-setup_done.md` and ADR 008 for how this reaches production.

### Optional: converting existing rows

Only needed if the database has habits you want to keep, for example once there are real users.
Run this first to see what's there:

```sql
SELECT frequency_type, frequency_times_per_period, count(*)
FROM habits.habits
WHERE NOT is_deleted
GROUP BY 1, 2 ORDER BY 1, 2;
```

Then add `migrationBuilder.Sql(...)` blocks after the generated `AddColumn` calls. Use frozen
constants (`Daily = 1`, `Weekly = 2`, `Monthly = 3`, `MondayToFriday = 62`), not the enums: a
migration has to produce the same SQL even after the enums change.

1. Old "Weekdays" habits → real Mon–Fri days:
   ```sql
   UPDATE habits.habits
   SET frequency_week_days = 62,          -- Monday..Friday bits: 2+4+8+16+32
       frequency_times_per_period = 1
   WHERE frequency_type = 2 AND frequency_times_per_period = 5;
   ```
   This is a judgement call: the old frontend saved "Weekdays" and "Custom: weekly × 5" the same
   way, and "5× a week, any days" is now a real option.
2. Counts inside the new rules (phase 1, step 1.3):
   ```sql
   UPDATE habits.habits SET frequency_times_per_period = 1
   WHERE frequency_type = 1 AND frequency_times_per_period <> 1;   -- Daily: no count
   UPDATE habits.habits SET frequency_times_per_period = 7
   WHERE frequency_type = 2 AND frequency_times_per_period > 7;    -- Weekly: at most 7
   UPDATE habits.habits SET frequency_times_per_period = 31
   WHERE frequency_type = 3 AND frequency_times_per_period > 31;   -- Monthly: at most 31
   ```
3. `Down()`, **before** the `DropColumn` calls: set `frequency_times_per_period = 5` where
   `frequency_type = 2 AND frequency_week_days = 62`. `Daily × N` and the capped counts don't come
   back.

| Before | After conversion |
|---|---|
| Daily × N | Daily × 1. If N mattered, set a measurable target ("at least N") |
| Weekly × 5 | Weekly, Mon–Fri |
| Weekly × N (N ≠ 5, ≤ 7) | Weekly, no days, × N. Same meaning as before |
| Monthly × N (≤ 31) | Monthly, no days, × N. Same meaning as before |

---

## Step 2.3: Application models

**Convention:** models are grouped by who uses them.

| Folder | Namespace | Used by | Rules |
|---|---|---|---|
| `Models/Request/` | `Habit.Application.Models.Request` | **command** input (`CreateHabitCommand`, `UpdateHabitCommand`) | `…RequestModel`. Optional fields where the client may leave them out. No mapping methods: the aggregate builds the value objects from raw values |
| `Models/Response/` | `Habit.Application.Models.Response` | **query** output (`GetHabitsQuery`) | `…ResponseModel`. Every field the API always returns is non-nullable. A static `FromDomain` maps from the value object |
| `Models/` | `Habit.Application.Models` | **services** and cross-module contracts (`ITagService` → `TagModel`) | `…Model`, shared shapes not owned by a single command or query |

Split a model even when the request and response shapes look the same today (`Timing`), so a
later change to one side doesn't silently change the other, and the OpenAPI schema says exactly
what each direction requires.

For the schedule, delete `Models/FrequencyModel.cs` and `Models/TimingModel.cs` and add four
files:

`Models/Request/FrequencyRequestModel.cs`. Everything except the type is optional:

```csharp
namespace Habit.Application.Models.Request;

public sealed record FrequencyRequestModel(
    FrequencyType Type,
    IReadOnlyList<DayOfWeek>? WeekDays = null,
    IReadOnlyList<int>? MonthDays = null,
    int TimesPerPeriod = 1);
```

`Models/Request/TimingRequestModel.cs`:

```csharp
namespace Habit.Application.Models.Request;

public sealed record TimingRequestModel(TimeOnly? At = null, int? DurationMinutes = null);
```

The handler passes their raw values to the aggregate (step 2.4), which builds and validates the
value objects.

`Models/Response/FrequencyResponseModel.cs`. Nothing is optional; it needs
`using Habit.Domain.Extensions;` for `ToDaysOfWeek()`:

```csharp
namespace Habit.Application.Models.Response;

public sealed record FrequencyResponseModel(
    FrequencyType Type,
    IReadOnlyList<DayOfWeek> WeekDays,
    IReadOnlyList<int> MonthDays,
    int TimesPerPeriod)
{
    public static FrequencyResponseModel FromDomain(Frequency frequency) =>
        new(
            frequency.Type,
            frequency.WeekDays.ToDaysOfWeek(),
            frequency.MonthDays.ToDays(),
            frequency.TimesPerPeriod);
}
```

`Models/Response/TimingResponseModel.cs`. `At` and `DurationMinutes` stay nullable, because
"any time" and "no duration" are real values, not missing ones:

```csharp
namespace Habit.Application.Models.Response;

public sealed record TimingResponseModel(TimeOnly? At, int? DurationMinutes)
{
    public static TimingResponseModel FromDomain(Timing timing) =>
        new(timing.At, timing.DurationMinutes);
}
```

`HabitResponseModel` (the `GetHabitsQuery` item, formerly `HabitModel`): `Frequency` changes type to `FrequencyResponseModel`,
and it gets `public required TimingResponseModel Timing { get; set; }`.

**The other habit models follow the same convention**, so `Models/` ends up as:

```
Models/
  Request/   FrequencyRequestModel, TimingRequestModel, TargetRequestModel,
             MilestoneRequestModel, HabitAutomationFilterRequestModel (+ Github/Strava/GoogleHealth)
  Response/  HabitResponseModel, FrequencyResponseModel, TimingResponseModel,
             TargetResponseModel, MilestoneResponseModel
  TagModel   (returned by ITagService, a service model)
```

`HabitModel` is renamed to `HabitResponseModel`, including `Id<HabitResponseModel>` in
`CreateHabitCommandResponse`, `UpdateHabitCommand` and the endpoints. `Habit.DataTransfer`'s own
`HabitModel` is a separate cross-module model and stays. The OpenAPI schema names change with
these renames; the frontend writes its models by hand, so nothing breaks there.

`TimeOnly` serializes as `"07:00:00"`; the frontend sends and parses that (phase 3). Enums stay
numeric, as in the rest of the habit API.

---

## Step 2.4: Commands and validators

`CreateHabitCommand` and `UpdateHabitCommand`:

- `Frequency` changes type to `FrequencyRequestModel`.
- add `TimingRequestModel? Timing`. `null` means any time with no duration, so old clients keep
  working. On **update**, `null` also clears a time that was set before. That's harmless here,
  because phase 3 sends the existing timing back, in the same branch. Just don't ship phase 2
  alone to users with timed habits.
- in the handler, copy the raw values into the aggregate request. The only conversion is
  weekdays (API array → flags); month days go in as plain `int`s and the aggregate validates
  them:
  ```csharp
  new HabitAggregateCreateRequest(
      …,
      request.Frequency.Type,
      (request.Frequency.WeekDays ?? []).ToWeekDays(),
      request.Frequency.MonthDays ?? [],
      request.Frequency.TimesPerPeriod,
      request.Timing?.At,                  // omitted timing = any time
      request.Timing?.DurationMinutes,
      …)
  ```
  The handler doesn't build or validate value objects. A bad schedule comes back from
  `HabitAggregate.Create`/`Update` as a failed `Result`, which the existing
  `if (habitResult.IsFailure)` already returns.
- **Both `Restore` callers** pass `entity.Timing` and `entity.CreatedAtUtc` through the restore
  request. The callers pass arguments **by position**, and the two new ones go right after
  `entity.Frequency`, in the same order as the record:
  ```csharp
  new HabitAggregateRestoreRequest(
      …,
      entity.Frequency,
      entity.Timing,
      entity.CreatedAtUtc,
      entity.Target,
      …)
  ```
  The callers are:
  - `UpdateHabitCommand`;
  - `HabitEntryCreatedIntegrationEventHandler` (logging an entry restores the habit to mark it
    done). Miss this one and it doesn't compile; once it compiles, a missing `Timing` would wipe
    the habit's time every time an entry is logged.

The endpoints bind `CreateHabitCommand` and `UpdateHabitCommand` straight from the body, so there
are no separate API request records to change.

`CreateHabitCommandValidator` and the update validator: change the
`Frequency.TimesPerPeriod > 0` rule to `InclusiveBetween(1, 31)`. Add only the **shape** checks,
and leave the cross-field rules to the domain:

- each `Frequency.WeekDays` item `IsInEnum()`, and each `Frequency.MonthDays` item is 1–31.
  A "no duplicates" rule is optional: repeated days are harmless (flags and the OR in
  `MonthDays.Create`).
- `Timing.DurationMinutes` is between 1 and 1440 when set.

Don't duplicate "a time needs fixed days", "times only without days" or the 7/31 limits here. The
aggregate returns a `BadRequest`, and the endpoint already turns it into a 400.

---

## Step 2.5: Query

- `GetHabitQueryModel`: add `public required Timing Timing { get; set; }`.
- `HabitResponseModel`: add `public required TimingResponseModel Timing { get; set; }` (step 2.3).
- `GetHabitsQuery`:
  - in the EF `Select`, add `Timing = h.Timing`, the same way `Frequency = h.Frequency` is
    selected now;
  - in the in-memory `Select` after `ToListAsync`, build the response with
    `FrequencyResponseModel.FromDomain(h.Frequency)` and `TimingResponseModel.FromDomain(h.Timing)`. EF can't
    translate them, so they have to run after `ToListAsync`. That replaces the current
    `new FrequencyModel(h.Frequency.Type, h.Frequency.TimesPerPeriod)`.

This query is the only place where the frontend reads habits.

These don't need changes: `Habit.DataTransfer/Models/HabitModel` (id, name and type, used by
`habit-entry`), `HabitNameDescriptionChangedIntegrationEvent` (used by `search`), and
`ai-coach`, which doesn't read frequency.

---

## Step 2.6: Regenerate OpenAPI

Building `Dailu.Api` regenerates `src/api/Dailu.Api/OpenApi/openapi.json`. Commit it with this
phase, and check that the diff shows `weekDays`, `monthDays` and `timing`, and that
`timesPerPeriod` is still there. Requests and responses now get separate schemas:
`FrequencyRequestModel` has only `type` required; `FrequencyResponseModel` has every field
required; `TimingRequestModel` and `TimingResponseModel` both have nullable `at` and
`durationMinutes`.

---

## Verify

- `dotnet ef database update`, or start the AppHost. In Postgres, `habits.habits` has the four
  new columns, and `frequency_times_per_period` is still there.
- Delete the old habits in the app. `GET /habits` then returns only habits created after this
  phase, each with `weekDays`, `monthDays`, `timesPerPeriod` and `timing`.
- With the Scalar/OpenAPI UI or `.http` requests:
  - Weekly Mon/Wed/Fri at `07:00` for 45 min → 201;
  - Weekly, no days, `timesPerPeriod: 2`, 30 min → 201; the same at `07:00` → 400;
  - Weekly Mon with `timesPerPeriod: 2` → 400; Daily with `timesPerPeriod: 2` → 400;
    Weekly with `timesPerPeriod: 8` → 400;
  - Monthly days `[1, 15]` → 201; Monthly with `weekDays` → 400;
  - Weekly with no days and `timing.at` set → 400 with the domain message;
  - Daily at 23:30 for 45 min → 400.
- `dotnet test` is green for the habit module, including the architecture tests.
- The old frontend keeps saving, but with the wrong meaning: its "Weekdays" mode sends
  `weekly × 5` and no `weekDays`, which is now "5 times a week, any days", and its
  "Custom daily × N" now gets a 400. That's expected. Do phase 3 right after, in the same
  branch, and don't create habits worth keeping until then.
