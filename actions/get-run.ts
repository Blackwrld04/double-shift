import { defineAction, fail } from "@agent-native/core/action";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import type { MonteCarloResult, SimEvent, TimelinePoint } from "../server/lib/sim.js";
import { parseJson } from "../server/lib/workspace.js";

export default defineAction({
  description:
    "Read one stored simulation run by id, or the most recent run when runId is omitted. Returns the inputs snapshot, metrics, timeline and event log so the agent can explain exactly why a service degraded.",
  schema: z.object({
    runId: z.string().optional().describe("Run id returned by run-scenario or compare-scenarios"),
  }),
  http: { method: "GET" },
  readOnly: true,
  searchHints: ["run result", "simulation evidence", "timeline", "events"],
  run: async ({ runId }) => {
    const db = getDb();
    const [run] = runId
      ? await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1)
      : await db.select().from(schema.runs).orderBy(desc(schema.runs.createdAt)).limit(1);
    if (!run) {
      fail(
        runId ? `No run found with id “${runId}”.` : "No simulation runs yet. Call run-scenario first.",
        { statusCode: 404 },
      );
    }
    const [scenario] = await db
      .select()
      .from(schema.scenarios)
      .where(eq(schema.scenarios.id, run.scenarioId))
      .limit(1);
    return {
      run: {
        id: run.id,
        scenarioId: run.scenarioId,
        scenarioName: scenario?.name ?? run.scenarioId,
        seed: run.seed,
        replications: run.replications,
        status: run.status,
        createdAt: run.createdAt,
      },
      metrics: parseJson<MonteCarloResult["metrics"]>(
        run.metricsJson,
        {} as MonteCarloResult["metrics"],
      ),
      timeline: parseJson<TimelinePoint[]>(run.timelineJson, []),
      events: parseJson<SimEvent[]>(run.eventsJson, []),
      inputs: parseJson<Record<string, unknown>>(run.snapshotJson, {}),
    };
  },
});
