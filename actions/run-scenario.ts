import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { loadWorkspace, runScenarioToResult, storeRun } from "../server/lib/workspace.js";

export default defineAction({
  description:
    "Run a Monte Carlo service simulation for a scenario. Returns aggregate metrics (P95 wait, walkouts, net contribution, kitchen P95, station bottlenecks) plus a representative timeline and event log. The model is deterministic and seeded; the same scenario and replication count produce comparable results. Call compare-scenarios to evaluate two or three candidates side by side.",
  schema: z.object({
    scenarioId: z.string().min(1).describe("Scenario id from get-workspace"),
    replications: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("How many seeded service replications to run. 25 is the demo default; 50 is a stronger confidence interval."),
    seed: z.number().int().optional().describe("Optional base seed. Omit for the demo seed."),
  }),
  http: { method: "POST" },
  searchHints: ["simulate", "run service", "monte carlo", "scenario"],
  run: async ({ scenarioId, replications, seed }) => {
    const workspace = await loadWorkspace();
    const scenario = workspace.scenarios.find((candidate) => candidate.id === scenarioId);
    if (!scenario) fail(`Unknown scenario “${scenarioId}”. Call get-workspace for the list.`, { statusCode: 404 });
    const result = runScenarioToResult(workspace, scenario, replications, seed ?? 20261109);
    const run = await storeRun(scenario, result, workspace);
    return {
      runId: run.id,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      metrics: result.metrics,
      timeline: result.timeline,
      events: result.events,
      representativeSeed: result.representativeSeed,
      runs: result.runs,
    };
  },
});
