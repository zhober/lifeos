---
name: panel
description: Coordinate several relevant experts and a critical reviewer, then archive their complete responses and a unified plan. Use for cross-domain questions, overall condition, or integrated planning.
argument-hint: <question>
---

# Consult a panel

Question: $ARGUMENTS

Travel panels use docs/domains/TRAVEL.md. travel-planner handles route/logistics; finance handles financial implications, health/fitness functional questions, nutrition dietary needs, shopping equipment and psych companion negotiation. Assign only distinct needed questions with minimum permitted evidence. Preserve exact user-selection/current-source/actual distinctions and existing critic gates. A panel or passing arithmetic/review does not confirm availability or authorize reservations/payments/changes/cancellations.

Apply docs/core/RESEARCH.md to every participating role. Reuse one source packet and allocate only distinct necessary evidence questions; a panel does not make literature research mandatory. The coordinator records and scopes any justified deep investigation, then shares its results. Independent judgments and critic review can proceed with local/lightweight verification when sufficient.

Use docs/core/COLLABORATION.md for shared cases and coordinator-mediated follow-up questions, preserving one evidence set, exact bindings, supporting/contrary assessments, and reassessment after corrections. For health evidence follow docs/domains/HEALTH.md. An expert answer is not clinical verification or final approval; the existing critic rounds and task gate remain required.

Shopping-related panels inherit docs/domains/SHOPPING.md's advisory-only/login boundary. A passing critic review or integrated plan never authorizes cart/checkout/order/payment or after-sales execution; users perform those actions manually. All participants use the same scoped research sources and user-handled authentication.

Financial panels inherit docs/domains/FINANCE.md's permitted-source/worksheet/currency/coverage rules and no-account-action boundary. finance-advisor handles financial implications, shopping handles actual offers/quality, career handles work/income assumptions and psych-coach interpersonal considerations. Use only distinct necessary questions, preserving hypothetical/forecast/actual distinctions. A panel, financial calculation or passing review never authorizes trades, transfers, borrowing, bill payment or tax filing.

Apply `docs/core/ORCHESTRATOR.md` for the durable request, compound intents, and step outcomes. Complete new record capture first and retrieve relevant current facts and historical episodes under `docs/core/MEMORY.md`; provide the same sourced evidence packet to participating roles.

For work/career questions, use docs/domains/CAREER.md's exact design/adoption, actual time-basis, milestone/output/feedback and opportunity/process evidence. Career-coach assesses work priorities and requirements; study-coach assesses learning in the needed modes, and health constraints remain with the relevant role. Preserve hypotheses and avoid counting plans or missing records as actual performance. Do not count a historical learning alias or mode as an additional independent panel expert.

Use `docs/core/CONTROL.md` for lifecycle and plan changes. Declare each expert and critic step, input references, dependencies, and waiver policy. Mark essential lead/review/archival work non-waivable; explicitly eligible supporting roles may be waived with evidence. A degraded panel reports missing roles and completes with gaps. Callbacks carry the current plan revision and matching attempt ID.

For emotional/interpersonal panels use docs/domains/PSYCH.md. psych-coach handles emotional context, suitability, willingness and communication/cooperation; shopping-advisor supplies specific gift/product evidence, career-coach supplies formal project/work strategy, and health/study roles keep their responsibilities. Consult only required roles and share necessary original evidence. Real-world people/consent are distinct from expert-roster participants; mode agreement, simulated replies and expert approval do not establish consent or a completed interpersonal action. Ordinary single-role interactions do not require a panel.

Apply `docs/core/REVIEW.md`: panel review is required. Declare proposal review, final review, dispositions, a required non-waivable read validation step with `review_gate: true`, and archival dependencies. Read `review.max_final_rounds` from `project.json`; preserve cumulative rounds across revisions. A passing review does not remove other task gaps.

Follow the language policy in `AGENTS.md`. Use the resolved interaction language for expert responses and the final plan; maintained role instructions remain English.

## Workflow

1. Discover the current roster with `node tools/experts.mjs`. Choose one lead and normally one to four relevant supporting experts. Keep the critical reviewer out of the initial group. Let the role most directly responsible for the question lead; overall lifestyle assessment normally uses the health advisor.
2. Invoke lead and supporting experts independently and in parallel when supported. Provide each with the original question, date, interaction language, lead/support assignment, and participant list. Supporting roles address only their domains. If the runtime cannot run independent agents, execute roles sequentially and describe that mode accurately.
3. Save the collected proposals as an immutable labeled target and give them to the critic with the original request, complete source packet, constraints, exact expert responses, and historical outcomes. Obtain a proposal-review verdict and every evidence-linked finding; record main-assistant dispositions and return substantive corrections to the responsible experts.
4. As the main assistant, combine the proposals around the lead expert's assessment:
   - Explain supported agreement.
   - Identify conflicts over time, energy, recovery, or sleep and explain the tradeoff.
   - Prioritize health safety, sleep and recovery, the user's recorded goal priorities, then other concerns.
   - Give at most five concrete, measurable actions and identify the responsible role.
5. Save the exact final draft as a new immutable target. Ask the critic to review its combined demands, new synthesis claims, disclosures, and every prior material finding. Repair and re-review within docs/core/REVIEW.md's round limit. Save all rounds and dispositions in a review packet; reject stale target/source bindings. Any final text change requires a new bound final review.
6. Run `node tools/review.mjs check <packet-path>`. Only a passing packet can complete the declared review gate; include `review_packet` and that packet in the successful step artifacts. Missing decisive evidence, unavailable essential review, or unresolved material issues remain visible; do not silently waive them or mark a blocked plan approved.
7. Save every full original response as an artifact. Archive with expert `panel`, `review_packet`, and `summary` exactly matching the reviewed final target. List all expected roles including the critic once; the review packet preserves every critic round separately. If incomplete, use `provisional: true` and disclose missing responses/approval without completing the gate. A later final archive has a new operation ID and retains partial versions.
8. Append qualifying personal insights and perform the durable updates below; only the approved final proposal becomes proposed personal actions. Factual capture is independent of proposal approval.
9. Present the reviewed plan, material tradeoffs, remaining minor notes, task gaps, and archive path in the configured interaction language. If blocked, present the status and evidence needed rather than an approved actionable plan.

## Durable personal updates

Capture new goals, constraints, attempted methods and outcomes, and newly stated facts. Update `profile/goals.md`, `profile/me.md`, or the appropriate expert knowledge files within the user's authorization. Preserve existing headings and add a dated old-to-new history entry for changed facts, citing the consultation.

Capture immutable memories under `docs/core/MEMORY.md` for relevant facts and episodes across every domain, including one-off or resolved events. Track proposed actions and their later outcomes separately with `tools/work.mjs`; acceptance and completion require explicit supporting evidence. Use `tools/files.mjs` for safe mutable updates.

Do not infer a lasting language preference from the language of a single message. If the user requests a persistent language change, save it using `node tools/language.mjs set <language-tag>`.

## External knowledge

Save reusable externally sourced knowledge in the responsible expert's `knowledge.md`, including titles, links, evidence levels, and lookup dates. Personal insights require their own longitudinal evidence. Preserve original expert wording in the advice archive.
