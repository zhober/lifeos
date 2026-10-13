# Light path for simple questions

Use this for a general-knowledge question, or a low-stakes personal question one answer can settle, including a summary of the user's own records with simple tips ("how did I sleep last week?"). Read this file plus `AGENTS.md`; that is enough. Do not open the full ask workflow, orchestrator, rules, research policy or role files.

## Answer

1. Answer directly in the configured interaction language.
2. Read only the personal records the answer actually needs. For a period summary run `node tools/stats.mjs --from YYYY-MM-DD --to YYYY-MM-DD` (`--help` lists fields; ratings are 1-5) instead of reading whole journals; open one journal only for a specific detail. If it uses personal context, respect saved restrictions (`node tools/privacy.mjs show <scope>`; e.g. sleep and body use `health`, food `nutrition`) and do not ask for withheld details.
3. No `work.mjs` request, plan or steps; no critic; no expert role. Look something up only when a fact is uncertain or changes over time, with one focused check.
4. Separate general knowledge from the user's own data; label estimates, inferences and missing data. Do not invent personal facts.

If a missing detail would change the answer, ask at once with 2-4 numbered options instead of guessing at length.

## Keep a personalised recommendation

A purely general answer needs no file. If the answer gives a personalised recommendation worth keeping, persist it with one command:

```text
node tools/advice-note.mjs <input.json | -> [--dry-run]   # "-" reads stdin
```

```json
{ "question": "<the user's words, verbatim>", "answer": "<the answer as given>",
  "sources": ["journal/2026/2026-10-12.md", "node tools/stats.mjs --days 7"],
  "captured_at": "2026-10-13T21:40:00+08:00" }
```

It appends one entry to `advice/YYYY-MM-DD-assistant.md` through the hash-checked writer. Existing entries are never rewritten; rerunning the same input changes nothing. `captured_at` defaults to now; `sources` is optional.

## Escalate to `workflows/ask/SKILL.md` when

- health symptoms beyond mild, any red flag, or medication, supplement or dosing questions;
- a significant money or time commitment, or a purchase, travel or financial decision;
- a plan spanning several domains or steps;
- the user asks for an expert, a panel, a review or deeper research;
- the evidence conflicts, or answering needs a broad search of history;
- the message also reports a record: record it first (`workflows/log/QUICK.md`), then answer.

Emotional distress with any self-harm risk is never a light question: follow the safety floor in `AGENTS.md` first.
