# Request lifecycle and plan control

Use this contract with `docs/core/ORCHESTRATOR.md`. The original request is immutable; control, plan, attempt, waiver, and artifact events preserve what changed, why, and which files support it. These instructions are English; user-facing messages follow the current language preference.

A simple record completed by `tools/quick-log.mjs` is outside this lifecycle: it opens no request, so it has no steps, attempts, or plan revisions to control. It still uses the safe-write rules below — checked writes for the journal and immutable records for canonical data — and a repeated identical invocation is recognized as the same operation rather than replanned. Correcting a record it created uses the full procedure and a superseding version.

## State meanings

| State | Meaning | New steps |
|---|---|---|
| pending / in_progress / partial / failed | Active execution with its current results | Only ready steps may start |
| paused | The user explicitly put the request on hold | Disabled until explicit resume |
| waiting | A concrete input, capability, or conflict blocks progress | Disabled until new input or condition resolution |
| cancelled | The user withdrew this request | Disabled; history and results remain |
| superseded | The user replaced this request with a specific child request | Disabled; follow the replacement link |
| completed | Current planned work succeeded | Closed |
| completed_with_gaps | Current plan finished with disclosed waived or skipped work | Closed; show the limitations |

Computed `execution_state` describes step results, while `control_state` describes a hold or withdrawal. A failure is not a user cancellation. A paused or waiting request is not permission to continue merely because time has elapsed.

## Commands

All mutation commands read a JSON payload from an existing file. Use a stable operation ID for an identical retry; use a new operation ID for a new user instruction or changed result.

```text
node tools/work.mjs control <input.json>
node tools/work.mjs replan <input.json>
node tools/work.mjs step <input.json>
node tools/work.mjs capture <input.json>
node tools/work.mjs waive <input.json>
node tools/work.mjs status <request-id>
node tools/work.mjs requests --ready
node tools/work.mjs requests --all
```

## Pause, wait, resume, and cancel

Control input includes `operation_id`, `request_id`, `action`, `reason`, `basis`, and nonempty `sources` pointing to captured messages or relevant artifacts.

- `pause`, `cancel`, and `supersede` require basis `user_request`. Preserve the actual user instruction before updating state; do not reinterpret a hypothetical example as a withdrawal.
- `wait` uses `missing_input`, `unavailable_tool`, `conflict`, or `runtime_failure`. Save the unresolved question or error. Wait only for information needed to proceed; use clearly stated assumptions for nonessential gaps.
- `resume` applies to a paused or waiting request and needs `user_request`, `input_received`, or `condition_resolved` with its evidence. Preserve completed results and continue only unfinished work.
- Closed requests are not reopened. A genuinely new instruction starts a linked `follow_up` request, using prior results as evidence when relevant.

Cancellation stops new request steps; it does not erase facts, undo external effects, or automatically change previously accepted actions and goals. Update those separately only when the user's instruction covers them.

The runtime must handle any real in-flight process or agent cancellation. Recording a stop event does not prove that an external call was terminated. Preserve late output as evidence; do not apply new profile changes, proposals, or downstream analysis from the stopped request.

## Replace a goal

1. Start a new request with `parent_request` set to the old ID and `relation_to_parent: replaces`. The new request is waiting and cannot dispatch yet.
2. Control the old request with `action: supersede`, `replacement_request` set to that exact child ID, and the user's recorded reason and sources.
3. The old request stops dispatching and the new one becomes eligible. Repeating either operation after interruption uses the same inputs and identifiers.

An unrelated request cannot activate through this handshake. Use `follow_up` rather than replacement for a closed parent. If a candidate replacement is abandoned, cancel that candidate explicitly; do not infer cancellation of unrelated requests.

## Revise a plan

`replan` requires `request_id`, `operation_id`, `expected_revision`, `steps`, `reason`, `basis`, and `sources`. Valid bases are `user_request`, `new_information`, `runtime_failure`, and `source_change`.

Store a new plan revision rather than editing the original. If workers are in flight, pause first and address their runtime execution. A replan does not implicitly resume a paused or waiting request.

- Declare `reuse_steps` explicitly. Only successful steps with unchanged definitions and inputs can be reused. Their dependencies must also be reused, and artifacts must still exist and be unchanged, or retain the exact captured quotation.
- Declare `invalidate_steps` explicitly when a completed read must be recalculated. A completed write or external effect cannot be replayed within the same request; create distinct authorized work instead.
- Removing unfinished mandatory, non-waivable work requires an explicit user scope change. A tool failure alone does not authorize hiding an essential step.
- Preserve omitted steps, earlier revisions, and previous outputs in history. Completion refers to the current authorized scope, not to a claim that every earlier plan was fulfilled.

Step definitions use stable identifiers and `depends_on`. Declare `effect` as read, write, or external; declare `inputs` when cached results depend on source files. Mark critical steps non-waivable. Do not use broad names like record or analyse as a substitute for knowing their effects.

For triggered advice under docs/core/REVIEW.md, add a required non-waivable read step with `review_gate: true` and no expert identifier after final critic review/dispositions. Successful completion requires `review_packet` in its artifacts and a current passing review. The gate is separate from completing a critic invocation. Final archival verifies the exact target again; a provisional archive or an audit-only adverse verdict cannot satisfy a release gate. Preserve cumulative reviewer rounds across replans and respect the shared final-round limit.

## Attempts, results, and late callbacks

Use `step` with status `running` before asynchronous expert or external work. Save the returned `attempt_id` and optionally a `worker_id`. Only one attempt can own a running step; repeat the same operation to recover a committed claim rather than launching another worker.

An asynchronous or budgeted successful result needs the matching running attempt. If `max_attempts` is configured, respect it; do not loop indefinitely or silently reset a budget. After a plan revision, callbacks must supply the current `plan_revision`. Older callbacks or attempt identifiers cannot complete a newer step.

Use `capture` for late or stopped outputs: identify the actual step, original plan revision, known attempt when applicable, reason, and artifact paths. Capture retains evidence without advancing execution. A paused request may later verify and use the retained result after resume; a closed request uses a new follow-up if further work is requested.

## Explicit degradation

Use `waive` only for a step whose definition says `waivable: true`. Include a reason, sources, and basis `user_request`, `unavailable_tool`, `runtime_failure`, or `not_applicable`. A waiver is not a successful expert response.

Dependencies may proceed after a recorded waiver, but final state becomes `completed_with_gaps`. Do not waive a critical record, review, safety, or archive obligation simply to make the status appear complete. Resolve it, wait, or obtain an actual scope change.

Consultation archives must disclose every expert named in the current plan, including missing or waived roles. Save original responses unchanged. Archive snapshots retain the captured plan revision and request state, making identical archive retries stable after later controls or plan changes.

## Before replying

Check the current task state and ready, blocked, in-flight, and waived steps. Explain completed work, omissions, the stop or waiting reason, and the next permissible action in the user's language. Use current interaction preferences; the request's original language is provenance, not an override of a later user preference.
