# Double Shift

An agent-native operations twin for **Osteria Nove**, a 24-table restaurant running a Friday dinner service (5:00–10:30 PM). Drag the floor plan, run the service, and let an agent test staffing, layout and demand changes against many simulated Fridays before anything touches the live floor.

## How it works

- **Deterministic engine** (`server/lib/sim.ts`): a seeded TypeScript simulation of arrivals, host seating, server sections, kitchen stations, table turns, walkouts, overtime and contribution margin. The app runs it as a Monte Carlo batch (10, 25 or 50 replications) and aggregates P95 waits, walkouts, net and station queues. The LLM never computes numbers; it calls actions and reads results.
- **Scenarios** hold a demand multiplier, patio on/off, callouts and a list of staged changes. The baseline scenario is the control for every what-if.
- **Human approval gate.** The agent can simulate and stage a *proposal*. Only a person can press Apply (`apply-proposal` is `uiOnly`), and applying fails with a 409 if the proposal references rows that no longer exist.
- **Chat + UI share one action surface** (`actions/`). The workspace lives at `/home`, chat at `/chat`.

## Actions

| Action | Caller | Purpose |
| --- | --- | --- |
| `get-workspace` | agent / UI | Floor, staff, menu, scenarios, proposals, activity |
| `create-scenario` | agent / UI | Stage a what-if (demand, callouts, changes) |
| `run-scenario` | agent / UI | Monte Carlo run, stored as a run |
| `get-run`, `compare-scenarios` | agent / UI | Read results, compare against baseline |
| `create-proposal`, `list-proposals` | agent / UI | Stage changes for human approval |
| `apply-proposal`, `reject-proposal` | **UI only** | Resolve a proposal |
| `update-table` | **UI only** | Drag a table on the live floor |

## Develop

```bash
corepack enable
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # simulation + change-set tests
pnpm typecheck
pnpm agent-native:doctor
```

Local data lives in `data/pglite`. Set `DATABASE_URL` to use Postgres.

## Deploy (Vercel)

Build with the Vercel Nitro preset: `NITRO_PRESET=vercel pnpm build`. Production needs:

- `DATABASE_URL` — a Postgres connection string (Neon via the Vercel Marketplace). PGlite is local-only.
- `BETTER_AUTH_SECRET` — stable secret for sign-in.
- `CRON_SECRET` — Vercel sends it as the bearer for the background-jobs cron. On Hobby, set `AGENT_NATIVE_VERCEL_CRON_SCHEDULE` to a daily expression such as `0 9 * * *`.
- A model provider key for the agent (e.g. `ANTHROPIC_API_KEY`), set per your provider.

Run `pnpm migrate:production` against the production database before first traffic. Schema changes ship as appended migrations in `server/plugins/db.ts` (never edit one that has run). `netlify.toml` is a leftover from the template and is unused on Vercel.

## Notes

- This is a single-venue workspace: every signed-in operator shares one venue. Restrict sign-ups in production.
- Results are planning estimates, not a POS forecast.
