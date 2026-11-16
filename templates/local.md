# Local adjustments

Files here adjust the shared LifeOS instructions for this vault only. `local/<path>` adds to the shared file `<path>`: for example `local/workflows/log/QUICK.md` adds to `workflows/log/QUICK.md`. Where the two differ the local file wins, except over the safety floor in `AGENTS.md`. Startup lists every adjusted path.

- Write short additions, not copies of the shared file, so shared improvements still arrive on upgrade.
- Deployment never changes or removes anything here.
- A standing personal preference (one line, not a procedure) belongs in the working notes instead: `node tools/working.mjs add`.
- When an adjustment would help every user, also file a proposal in `evolve/pending/` from `templates/proposal.md`.
