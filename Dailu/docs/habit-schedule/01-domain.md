# Phase 1: the domain model

Goal: `Habit.Domain` can express every schedule in the README table, rejects combinations that
don't make sense, and answers "is this habit scheduled on day X?". No database or API changes
yet.

```
HabitAggregate
 ├─ Frequency.Create(type, weekDays, monthDays, timesPerPeriod)   ← times only without days
 ├─ Timing.Create(at, durationMinutes)            ← new
 ├─ cross-check: timing needs fixed days          ← new, in the aggregate
 └─ IsScheduledOn(DateOnly day)                   ← new
```

---

## Step 1.1: `WeekDays` flags enum

`src/modules/habit/Habit.Domain/Enums/WeekDays.cs`. A `[Flags]` enum with one bit per day, so a
set of days fits in one `int`:

```csharp
[Flags]
public enum WeekDays
{
    None = 0,
    Sunday = 1 << DayOfWeek.Sunday,     // 1
    Monday = 1 << DayOfWeek.Monday,     // 2
    // … Tuesday … Friday
    Saturday = 1 << DayOfWeek.Saturday, // 64
    Weekdays = Monday | Tuesday | Wednesday | Thursday | Friday,
}
```

Each bit is `1 << (int)DayOfWeek`, so converting from a `DayOfWeek` is a single shift.

**Helpers:** `Habit.Domain/Extensions/WeekDaysExtensions.cs` (namespace
`Habit.Domain.Extensions`), a `public static class`, so the rest of the code never does bit
maths:

```csharp
public static class WeekDaysExtensions
{
    // DayOfWeek.Monday → WeekDays.Monday
    public static WeekDays ToWeekDays(this DayOfWeek day) => (WeekDays)(1 << (int)day);

    // API input: [1, 3, 5] → Monday | Wednesday | Friday
    public static WeekDays ToWeekDays(this IEnumerable<DayOfWeek> days) =>
        days.Aggregate(WeekDays.None, (all, day) => all | day.ToWeekDays());

    // Frequency.Matches: "is Wednesday picked?"
    public static bool Contains(this WeekDays days, DayOfWeek day) =>
        (days & day.ToWeekDays()) != 0;

    // API output: Monday | Friday → [Monday, Friday]
    public static IReadOnlyList<DayOfWeek> ToDaysOfWeek(this WeekDays days) =>
        Enum.GetValues<DayOfWeek>().Where(days.Contains).ToList();
}
```

They don't validate: the command validator (`IsInEnum`) rejects out-of-range `DayOfWeek` values
first. Callers: `Frequency.Matches` (step 1.3), the create/update handlers and
`FrequencyResponseModel` (phase 2).

## Step 1.2: `MonthDays`

Days of the month need 31 bits, too many for a pleasant `[Flags]` enum.
`Habit.Domain/ValueObjects/MonthDays.cs` is a value object with its helpers as members. It must
be **`public`**, because `Frequency` exposes it and Infrastructure's EF converter (phase 2)
builds it:

```csharp
public readonly record struct MonthDays
{
    private const int AllBits = 0x7FFF_FFFF;           // days 1–31 → bits 0–30

    public int Bits { get; }

    private MonthDays(int bits) => Bits = bits;

    public static MonthDays None => default;
    public bool IsEmpty => Bits == 0;

    // API input, validated: anything outside 1–31 → BadRequest.
    public static Result<MonthDays> Create(IEnumerable<int> days) { … }

    // EF converter only: trusts the database, masks stray bits.
    public static MonthDays FromBits(int bits) => new(bits & AllBits);

    public bool Contains(int day) => day is >= 1 and <= 31 && (Bits & (1 << (day - 1))) != 0;

    // Highest picked day, 0 if none.
    public int Highest => IsEmpty ? 0 : 32 - BitOperations.LeadingZeroCount((uint)Bits);

    // API output: [1, 15, 31]
    public IReadOnlyList<int> ToDays() => Enumerable.Range(1, 31).Where(Contains).ToList();

    // The short-month rule: a picked day the month doesn't have falls on its last day.
    public bool Matches(DateOnly date)
    {
        var last = DateTime.DaysInMonth(date.Year, date.Month);
        return Contains(date.Day) || (date.Day == last && Highest > last);
    }
}
```

The constructor is private, so the only ways in are `Create` (validated) and `FromBits` (the
database). `Matches` is the "falls on the last day" decision from the README, and the only place
that implements it. `Highest > last` is the whole rule: "some picked day doesn't exist in this
month" is the same as "the highest picked day is past the end". If several picked days collapse onto the same last day (29, 30 and 31 in February), the habit
is simply scheduled that day, once.

---

## Step 1.3: Rework `Frequency`

`Habit.Domain/ValueObjects/Frequency.cs`. Add the two day sets, and **keep `TimesPerPeriod`**
for habits without picked days only:

```csharp
public FrequencyType Type { get; private set; }   // unchanged: Daily / Weekly / Monthly
public WeekDays WeekDays { get; private set; }    // None = N times a week, any days
public MonthDays MonthDays { get; private set; }  // None = N times a month, any days
public int TimesPerPeriod { get; private set; }   // sessions per week/month; 1 unless no days

public static Result<Frequency> Create(
    FrequencyType type, WeekDays weekDays, MonthDays monthDays, int timesPerPeriod = 1)

// Daily, or Weekly/Monthly with picked days → can have a time, sits on the clock.
public bool HasFixedDays => Type == FrequencyType.Daily
                            || WeekDays != WeekDays.None
                            || !MonthDays.IsEmpty;

// Calendar part of IsScheduledOn (step 1.6). Knows nothing about creation, end date or status.
public bool Matches(DateOnly day) => Type switch
{
    FrequencyType.Daily => true,
    FrequencyType.Weekly => WeekDays == WeekDays.None || WeekDays.Contains(day.DayOfWeek),
    FrequencyType.Monthly => MonthDays.IsEmpty || MonthDays.Matches(day),
    _ => false,
};
```

Keep every setter `private`. Your current draft has public `set;` on `Days` and `RepeatEvery`.
A `Frequency` should only come from `Create` or from EF.

Rules in `Create`, each a `BadRequest` with a clear message:

1. `type` is Daily, Weekly or Monthly, not `None`.
2. `weekDays != None` only when `type == Weekly`.
3. `monthDays != None` only when `type == Monthly`.
4. `timesPerPeriod >= 1`.
5. `timesPerPeriod > 1` only when there are **no fixed days** (Weekly or Monthly with nothing
   picked). With picked days, the days already say how often; for Daily, "3× a day" is a
   measurable target.
6. at most `7` for Weekly and `31` for Monthly (one session a day at most).

```csharp
private const int MaxPerWeek = 7;
private const int MaxPerMonth = 31;

if (timesPerPeriod < 1)
    return Result<Frequency>.BadRequest("Times per period must be at least 1.");

var hasFixedDays = type == FrequencyType.Daily || weekDays != WeekDays.None || !monthDays.IsEmpty;
if (timesPerPeriod > 1 && hasFixedDays)
    return Result<Frequency>.BadRequest("Times per period only applies when no days are picked.");

var max = type == FrequencyType.Weekly ? MaxPerWeek : MaxPerMonth;
if (timesPerPeriod > max)
    return Result<Frequency>.BadRequest($"At most {max} times per period.");
```

`Matches` doesn't look at the number: a "2× a week" habit is *scheduled* on every day of the
week, like "once a week". How many entries are still needed is *due*, which the frontend works
out from entries (phase 3).

**Compile errors are your to-do list.** The new `Create` signature breaks the commands and `GetHabitsQuery`. In this phase, fix only the domain and the aggregate (next step).
Phase 2 fixes the Application and Infrastructure layers.

---

## Step 1.4: New `Timing` value object

`Habit.Domain/ValueObjects/Timing.cs`, the same shape as `Target` and `Milestone`:

```csharp
public sealed record Timing
{
    private const int MinutesPerDay = 24 * 60;

    public TimeOnly? At { get; private set; }            // null = any time
    public int? DurationMinutes { get; private set; }    // null = no duration

    public bool HasTime => At is not null;

    private Timing() { }

    private Timing(TimeOnly? at, int? durationMinutes)
    {
        At = at;
        DurationMinutes = durationMinutes;
    }

    public static Result<Timing> Create(TimeOnly? at, int? durationMinutes)
    {
        if (durationMinutes is <= 0 or > MinutesPerDay)
        {
            return Result<Timing>.BadRequest("Duration must be between 1 and 1440 minutes.");
        }

        // Minute precision: the picker and the clock never use seconds.
        TimeOnly? start = at is { } time ? new TimeOnly(time.Hour, time.Minute) : null;

        if (start is { } s && durationMinutes is { } duration
            && s.Hour * 60 + s.Minute + duration > MinutesPerDay)
        {
            return Result<Timing>.BadRequest("A timed habit can't run past midnight.");
        }

        return Result<Timing>.Success(new Timing(start, durationMinutes));
    }
}
```

What `Create` does, in order:

1. **Duration range.** `durationMinutes is <= 0 or > MinutesPerDay` is false for `null`, so "no
   duration" passes without a separate null check.
2. **Drop seconds.** `"07:30:59"` is stored as 07:30. Do it before the midnight check so both
   use the same value.
3. **Midnight check**, only when both are set. Compare minutes as plain integers. Don't use
   `TimeOnly.Add`/`AddMinutes`: they wrap silently, so 23:30 + 45 min comes out as 00:15 and
   looks valid. Exactly midnight is allowed (23:30 + 30 min = 1440).
4. **No time and no duration** is a valid result, "any time". There's no separate
   `AnyTime` shortcut: `Create(null, null)` is how you make one.

All four combinations are valid inputs, as long as the numbers fit:

| `at` | `durationMinutes` | Meaning |
|---|---|---|
| null | null | any time, no duration |
| null | 30 | any time, takes 30 min ("read 30 min") |
| 07:00 | null | at 07:00; the clock draws a default 30-min slot |
| 07:00 | 45 | 07:00–07:45 |

`Timing` doesn't know about frequency. "Time only on fixed-day habits" needs both, so that check
goes in the aggregate.

---

## Step 1.5: Wire it into `HabitAggregate`

In `Habit.Domain/Aggregates/HabitAggregate.cs`:

1. **New private property** `Timing Timing { get; set; } = null!;`, like `Frequency`. It's always
   set by `Create`, `Restore` or EF.
2. **Request records.** The aggregate builds its own value objects from raw values, as it already
   does for `Target` and `Milestone`:
   - `HabitAggregateCreateRequest` and `HabitAggregateUpdateRequest`: keep
     `FrequencyType FrequencyType` and `int TimesPerPeriod`, and add
     `WeekDays WeekDays, IReadOnlyCollection<int> MonthDays, TimeOnly? At, int? DurationMinutes`.
   - `HabitAggregateRestoreRequest` gets `Timing Timing` and `DateTime CreatedAtUtc`. It keeps
     taking finished value objects, because they come from the database and are already valid.
3. **`BuildSchedule`**: one private static method that both `Create` and `Update` call. It
   builds the schedule value objects and runs the cross-check between them:

   ```csharp
   private static Result<(Frequency Frequency, Timing Timing)> BuildSchedule(
       FrequencyType frequencyType,
       WeekDays weekDays,
       IReadOnlyCollection<int> monthDays,
       int timesPerPeriod,
       TimeOnly? at,
       int? durationMinutes)
   {
       var monthDaysResult = MonthDays.Create(monthDays);
       if (monthDaysResult.IsFailure)
       {
           return Result<(Frequency, Timing)>.BadRequest(monthDaysResult.Error);
       }

       var frequencyResult = Frequency.Create(
           frequencyType, weekDays, monthDaysResult.Value, timesPerPeriod);
       if (frequencyResult.IsFailure)
       {
           return Result<(Frequency, Timing)>.BadRequest(frequencyResult.Error);
       }

       var timingResult = Timing.Create(at, durationMinutes);
       if (timingResult.IsFailure)
       {
           return Result<(Frequency, Timing)>.BadRequest(timingResult.Error);
       }

       if (timingResult.Value.HasTime && !frequencyResult.Value.HasFixedDays)
       {
           return Result<(Frequency, Timing)>.BadRequest(
               "A time of day needs a daily habit or picked days.");
       }

       return Result<(Frequency, Timing)>.Success((frequencyResult.Value, timingResult.Value));
   }
   ```

   In `Create` and `Update`, replace the existing
   `Frequency.Create(request.FrequencyType, request.TimesPerPeriod)` block with a call to
   `BuildSchedule(request.FrequencyType, request.WeekDays, request.MonthDays, request.TimesPerPeriod, request.At, request.DurationMinutes)`.
   Return its error the same way as the `Target` failure next to it, then assign `Frequency`
   and `Timing` from the result.

   This is the same idea as `ValidateAutomation`: one private method, two callers, no copy.
   `Result<T>` has no constraint on `T`, so the named tuple works as is.
4. **`Restore` and `ToEntity`**: copy `Timing` through like every other field.

**Optional, later:** `Target` and `Milestone` are still built twice, once in `Create` and once
in `Update`. They can move into a similar private method. That isn't needed for the schedule.

---

## Step 1.6: `IsScheduledOn(DateOnly day)`

A public method on the aggregate. It's the single definition of "scheduled", and phase 3 copies
it into TypeScript. The aggregate checks only what `Frequency` can't know, then delegates to
`Frequency.Matches` (step 1.3):

```csharp
public bool IsScheduledOn(DateOnly day) =>
    day >= DateOnly.FromDateTime(CreatedAtUtc)       // existed
    && (EndDate is null || day <= EndDate)
    && Status != HabitStatus.Completed
    && !IsArchived
    && Frequency.Matches(day);
```

Notes:

- **The creation date** comes from `BaseEntity.CreatedAtUtc`. The aggregate doesn't carry it
  today, so add it to the restore request and take it on create (the handler knows "now"). The
  frontend already uses creation as "existed on" (`existedOn` in `dashboard-day.ts`). This
  matches it.
- **Flexible habits** (Weekly or Monthly with no days, any `TimesPerPeriod`) are scheduled on
  *every* day. Whether they're still *due* (fewer than N entries this period) depends on entries,
  which isn't this method's job.
- It takes a `DateOnly`, never a `DateTime`. Turning "now" into the user's local date is the
  caller's job (see time zones in [05-later.md](05-later.md)).

---

## Step 1.7: Unit tests

`Habit.UnitTests` exists but is empty. Check that its `.csproj` references `Habit.Domain` and the
test packages in `Directory.Packages.props`. Then add:

- `WeekDaysExtensionsTests`: `[Mon, Fri]` → flags → back to `[Mon, Fri]`; `Contains`.
- `FrequencyTests`: weekdays only on Weekly; month days only on Monthly; `None` type rejected;
  `Matches` for each type. `TimesPerPeriod`: 0 rejected; Weekly no days × 2 accepted; Weekly no
  days × 8 rejected; Monthly no days × 31 accepted, × 32 rejected; Daily × 2 rejected; Weekly
  Mon × 2 rejected; Monthly [1] × 2 rejected; the default is 1.
- `MonthDaysTests`: `Create` rejects 0 and 32; `Highest`; `ToDays` round-trip; `Matches` for the 31st in 31-day and 30-day
  months and in February (leap and non-leap).
- `TimingTests`: duration 0 and 1441 rejected; 23:30 + 30 min accepted (ends exactly at
  midnight), 23:30 + 31 min rejected; 23:30:59 + 30 min accepted, because seconds are dropped
  first; `(null, null)` accepted with `HasTime == false`; `(null, 30)` accepted.
- `HabitAggregateScheduleTests`: a time on "Weekly, no days" is rejected (also with times = 2);
  a time on "Monthly, days 1" is accepted; "Weekly, no days, × 2, 30 min" is accepted and saves
  `TimesPerPeriod = 2`. Plus this `IsScheduledOn` table, created 2026-10-01, no end date:

| Schedule | Day | Expected |
|---|---|---|
| Daily | Thu 2026-11-05 | true |
| Weekly Mon/Wed/Fri | Tue 2026-11-03 | false |
| Weekly Mon/Wed/Fri | Wed 2026-11-04 | true |
| Weekly Sun | Sun 2026-11-08 | true |
| Weekly, no days | any day | true |
| Weekly, no days, × 2 | any day | true (the count is about *due*, not *scheduled*) |
| Monthly days 1, 15 | 2026-11-15 | true |
| Monthly days 1, 15 | 2026-11-16 | false |
| Monthly day 31 | 2026-11-30 | true (last day of a 30-day month) |
| Monthly day 31 | 2026-11-29 | false |
| Monthly days 29, 30 | 2027-02-28 | true (both fall on Feb's last day) |
| Monthly, no days | any day | true |
| anything | 2026-09-30 | false (before creation) |

Use real calendar dates, not offsets. Sundays and the 31st are where the bugs hide.

---

## Verify

- `dotnet test src/modules/habit/Habit.UnitTests` is green.
- Nothing in the database or API has changed yet. The remaining build errors are all in
  Application/Infrastructure, which phase 2 fixes.
