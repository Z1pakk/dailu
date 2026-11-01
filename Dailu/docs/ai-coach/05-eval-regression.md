# Phase 5: prompt and model regression eval

Goal: replace the manual "ask 10 questions and eyeball it" check from phase 2.7 with a runnable
harness that scores the coach against known facts, so changing the system prompt, a tool
description, or the model itself produces a pass rate instead of a vibe check.

This phase is optional hardening. Do it once you've changed the prompt or model more than once
and felt how easy it is to not notice a regression.

```
eval-cases.json (question + facts a correct answer must/must-not mention)
        │
        ▼
Dailu.AiCoach.EvalTests (console app) ── seeded test user, known 4-week dataset
        │                                 ── runs the REAL CoachChatService pipeline
        ▼
per case: does the final answer contain the required facts? ── pass/fail
        │
        ▼
report: pass rate, per-case detail ── compare across prompt/model changes
```

---

## Step 5.1: Why this isn't a unit test

A normal unit test asserts one deterministic outcome: given this input, the function returns
exactly that output, every time, forever (until you intentionally change the code). An LLM call
doesn't give you that — ask the same question twice and you can get differently-worded, and
occasionally differently-*correct*, answers, because sampling from the model's output
distribution is inherently probabilistic (even at low temperature). That means "assert the exact
reply" is the wrong tool for this problem entirely; what you actually want to know is "does the
coach still reliably land on the right facts," which is a *rate* across many cases, not a single
pass/fail. That's why this harness exists as its own thing: the whole point is to catch
regressions in **model behavior**, so it must call the real `IChatClient` through the real
`CoachChatService` — not a mock, which would only prove your plumbing didn't change, not that the
model still answers well. That makes it slow and nondeterministic by nature (small local models
vary run to run), so it doesn't belong in the normal `dotnet test` run that gates every commit.
Keep it as a separate, deliberately-run project, the same way phase 2.7's manual check was never
part of CI either.

---

## Step 5.2: Project setup

`src/tests/Dailu.AiCoach.EvalTests/` — a console app (not xUnit), referencing `AiCoach.Application`
and `AiCoach.Infrastructure` directly and composing a minimal host the same way `Dailu.Api` does
(same `AddAiCoachModule`, same `AddSearchModule` — the coach's `search_notes` tool needs the real
`search` module registered too, same `Ai:*` config), so it talks to the real pipeline end to end
against Ollama and a real (test) database.

```
Dailu.AiCoach.EvalTests/
  Program.cs                  minimal host + runner
  EvalCase.cs
  eval-cases.json
  EvalRunner.cs
  eval-results/               gitignored, timestamped reports land here
```

---

## Step 5.3: Eval cases

```csharp
public sealed record EvalCase(
    string Id,
    string Question,
    IReadOnlyList<string> MustContain,              // facts, case-insensitive substring match
    IReadOnlyList<string>? MustNotContain = null     // catches hallucinated numbers/habits
);
```

`eval-cases.json`, written against a fixed seed dataset (reuse or extend phase 2.7's "4 weeks of
known data" test user):

```json
[
  {
    "id": "consistency-running",
    "question": "How consistent was I with running this month?",
    "mustContain": ["9", "Monday"]
  },
  {
    "id": "notes-tired",
    "question": "When did I feel tired?",
    "mustContain": ["sore", "2026-09"]
  },
  {
    "id": "no-hallucinate-habit",
    "question": "How did my Yoga habit go?",
    "mustContain": ["don't have", "no habit"],
    "mustNotContain": ["Yoga:"]
  }
]
```

The last case matters as much as the first two: it checks the coach admits it has no data instead
of inventing an answer, which is exactly the kind of regression a prompt change can silently
introduce.

**Keep the seed dataset and the cases in sync.** If you add or change seeded entries, update the
facts `MustContain` expects — a stale eval case produces a confident false failure. If a case
relies on `search_notes`, remember the note only gets indexed if Ollama was reachable when it was
saved (`search` embeds inline in its event handler), or seed the `search.search_index` row
directly, vector included, to keep the harness fast and deterministic.

---

## Step 5.4: The runner

```csharp
public sealed class EvalRunner(CoachChatService coach, IAiCoachDbContext db)
{
    public async Task<IReadOnlyList<EvalResult>> RunAsync(
        IReadOnlyList<EvalCase> cases, CancellationToken ct)
    {
        var results = new List<EvalResult>();

        foreach (var evalCase in cases)
        {
            // A fresh conversation per case — no history bleed between questions.
            var conversationId = await CreateConversationAsync(ct);
            var reply = await RunSingleTurnAsync(conversationId, evalCase.Question, ct);

            var passed = evalCase.MustContain.All(
                    f => reply.Contains(f, StringComparison.OrdinalIgnoreCase))
                && (evalCase.MustNotContain?.All(
                    f => !reply.Contains(f, StringComparison.OrdinalIgnoreCase)) ?? true);

            results.Add(new EvalResult(evalCase.Id, passed, reply));
        }

        return results;
    }
}
```

`RunSingleTurnAsync` drains `CoachChatService.StreamReplyAsync` and concatenates the `delta` text,
the same way the Angular client does — reuse that logic rather than re-implementing streaming
here.

Output a small markdown table (case id, pass/fail, reply excerpt) plus an overall pass rate to
`eval-results/{timestamp}.md`.

---

## Step 5.5: Compare across prompt and model changes

Accept a config/CLI override so the same case set runs against different configurations without
touching `appsettings.json`:

```
dotnet run --project src/tests/Dailu.AiCoach.EvalTests -- --Ai:Chat:Model=qwen3:8b
dotnet run --project src/tests/Dailu.AiCoach.EvalTests -- --Ai:Chat:Model=glm-4:9b
```

Keep both reports. This directly answers the "compare before switching" guidance from phase 2.7 —
and from the model-choice discussion when evaluating `qwen3:8b` against alternatives — with
numbers instead of impressions.

---

## Step 5.6: Optional CI gate

Don't run this on every PR — it's slow and calls a live model. A scheduled job (nightly, or
triggered when `Ai:*` config, the system prompt, or `CoachTools` changes) that runs the eval and:

- posts the report as a build artifact always, and
- fails the job only if the pass rate drops below a threshold you've chosen deliberately (e.g.
  80%), not 100% — small local models won't hit 100% reliably, and chasing that threshold with
  prompt tweaks just overfits the eval set.

---

## ✅ Verify

1. Run the eval against `qwen3:8b`. Confirm the pass/fail calls look right by reading a few
   replies yourself — the harness is only as good as the `MustContain` facts you wrote.
2. Deliberately break the system prompt (e.g. remove the "use tools" instruction) and re-run.
   The pass rate should drop. If it doesn't, the harness isn't actually sensitive to prompt
   regressions and the cases need sharper facts.
3. Run the same cases against a second model (e.g. the `GLM-4-9B` alternative discussed earlier)
   and compare reports side by side.

Commit: `test(ai-coach): prompt/model regression eval harness`.
