# Later: deliberately out of scope

These came up while designing the schedule and were left out on purpose. None of them blocks
phases 1–4. Each has a note on what would change, so you can pick it up later.

## "Repeat every N" (every other day, every 2nd week)

Removed to keep the model small. Adding it back needs:

- `Frequency.RepeatEvery` (1–365) **and** a `StartDate` on the habit as the anchor. You can't
  count "every other day" without knowing which day was first;
- in `IsScheduledOn`: days since start `% N` for daily, weeks since the start's Monday `% N` for
  weekly, months since the start month `% N` for monthly;
- a migration backfilling `start_date` from `created_at_utc`;
- "Every [N] days/weeks/months" and a "Starts" date in the drawer, designed in Figma first.

## User time zone

Every "what day is it?" question is answered either in the **browser** (`localDay`) or in
**UTC** on the server (the `EndDate` validator, the `Complete()` future check). That's fine
while all schedule logic runs in the frontend.

It stops being fine once the **server** has to act at a user's local time: reminders,
server-side streaks, or the AI coach saying "you haven't done X today". Then:

- add `TimeZoneId` (IANA, e.g. `Europe/Kyiv`) to the user profile, captured from
  `Intl.DateTimeFormat().resolvedOptions().timeZone` on login;
- convert "now" to the user's local `DateOnly`/`TimeOnly` **before** calling
  `IsScheduledOn(day)`. The domain stays time-zone-free on purpose.

## Reminders and notifications

"At 07:00" is the obvious hook for a reminder, but it needs the time zone above, a delivery
channel (web push, email, Telegram…) and a scheduler (a `PeriodicTimer` worker like the
integration workers). That's a feature of its own; write an ADR first.

## Automation and time windows

`autoCheckSummary` in `habit-form-mapping.ts` says it "never promises a minimum or a time
window — the backend checks neither." With `Timing`, you *could* count only a Strava run that
falls inside `at … at + duration`. Don't do that silently, because it changes what ticks a habit.
If you want it, make it an explicit option on the automation filter.

## Streaks for flexible habits

The strict streak counts **fixed-day** habits on their scheduled days. "N times a week, any days"
habits stay out of it (the per-habit streak on the habit list does count them per week, phase 3,
step 3.6). The honest rule for them is per period ("a week counts if it was done that
week"), which is a separate weekly streak, not a day streak. Decide it in Figma together with how
the dashboard shows it.

## Server-side "due" and progress

`IsScheduledOn` lives in the domain, but *due* and *progress* (which need entries) stay in the
frontend. If the AI coach or reminders need them, add a query that combines `Habit.DataTransfer`
(with the schedule fields added) and entry counts. Port the TS logic once and test it against the
same tables.

## Skipping, pausing and exceptions

"Skip today", "pause for vacation", "not on holidays". Store these as rows
(`habit_schedule_exceptions(habit_id, day, kind)`) and have `IsScheduledOn` check them. Don't
keep stretching `Frequency`.
