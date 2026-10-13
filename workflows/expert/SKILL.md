---
name: expert
description: List, create, improve, disable, or restore expert roles through the system evolver. Use for roster management or requested changes to an agent's responsibilities or behavior.
argument-hint: list | new <domain> | edit <expert> <change> | disable <expert>
---

# Manage expert roles

Input: $ARGUMENTS

Follow the language policy in `docs/core/HANDBOOK.md`. Write role definitions, workflow instructions, and discovery metadata in English. Discuss requirements and results with the user in the configured interaction language.

An expert is one file under `agents/`. Workflows discover roles through `node tools/experts.mjs`; do not maintain a duplicate fixed roster. Resolve historical names through `node tools/experts.mjs --resolve <name> --json` and project.json definitions.role_aliases before new calls or edits. Aliases and working modes do not add active experts. Read `config/CONFIGURATION.md` before changing runtime configuration; roles and workflows remain shared across runtimes.

## List

Run `node tools/experts.mjs --all` and present a localized list that distinguishes domain roles from system roles.

## Introduce the next role

Before its first user review/introduction, use the evolver to check relevant retained research and public analogues under docs/core/RESEARCH.md. Perform focused lookup if source coverage is missing or outdated, save findings under evolve/, then explain current behavior and proposed reuse separately. State any negative/unverified result honestly. Do not treat a detailed introduction as a request for a broad literature review or for unrelated implementation.

## Create

1. Discover the current roster. If an existing role covers the need, consider improving its scope rather than duplicating it.
2. Use the system evolver to check existing implementations and draft a definition/templates under `evolve/`, applying docs/core/RESEARCH.md's local/lightweight-first effort rule. Use an existing vetted reference or focused lookup when sufficient; a broad comparative/literature survey needs a concrete hard question/material conflict or explicitly requested depth. Research, original prompts, and attribution stay there.
3. Resolve material unanswered requirements with the user, at most four questions: responsibilities and boundaries, required data, browsing needs, and advice style or output format. Reuse information already supplied.
4. Finalize the authorized English draft as `agents/<name>.md`:
   - Use a lowercase English identifier with hyphens and an English description beginning with the role title and explaining when to invoke it.
   - Reference `experts/_common.md` and include an exact `## Data and records` section; the roster utility extracts record paths from it.
   - Keep the prompt in English and the interaction language configurable.
   - Inherit the domain-independent long-term memory contract from `experts/_common.md` and `docs/core/MEMORY.md`. New domains use the same sourced, temporal facts and events, not a separate provider-specific memory store.
   - Put source attribution in `evolve/lineage.md`.
5. Draft any required record templates under `templates/records/<domain>/` and initialize absent records under `records/<domain>/`. For new daily fields, update the day template, field documentation, and relevant statistics defaults while preserving existing data.
6. If a knowledge directory is needed, add its templates and initialize absent user files.
7. Verify discovery with `node tools/experts.mjs` and present the role and a usage example.
8. Update lineage, candidate status, and the changelog through the evolver.
9. File discovery is immediate; native agent registration depends on the runtime and may require refresh or restart. When registration is unavailable, read the role file explicitly and disclose the execution mode.

## Improve

Ask the evolver to identify the issue and evidence, research where needed, and draft the requested change. The main assistant applies changes within existing user authorization. Distinguish role-specific changes from shared rules that affect other roles; seek clarification only for material scope that has not been authorized. Record adopted changes and attribution.

## Disable

Move the role file to `agents-disabled/` without deleting it. Retain historical advice and record the reason in the changelog. Restoring an ordinary disabled role means returning the same definition to the active directory. A role merged into another role with a declared historical alias requires an explicitly requested split and reconciliation of the canonical responsibilities/alias before restoration; do not recreate a second learning role from an archived prompt automatically. Run the layout checker after roster changes.

## Language invariant

New or revised maintained prompts stay in English even when feedback is provided in Chinese or another language. The user's language choice is a profile preference, not a reason to rewrite each role.
