import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { loadWorkspace, runScenarioToResult, storeRun } from "../server/lib/workspace.js";

function delta(value: number, baseline: number): number {
  return Math.round((value - baseline) * 10) / 10;
}

export default defineAction({
  description:
    "Run two to four scenarios with the same replication count and return a side-by-side comparison plus deltas against the first scenario. Use this after identifying candidate fixes, so the recommendation is based on simulated evidence rather than intuition.",
  schema: z.object({
    scenarioIds: z
      .array(z.string().min(1))
      .min(2)
      .max(4)
      .describe("Two to four scenario ids. The first is the baseline for deltas."),
    replications: z.number().int().min(5).max(100).default(25),
    seed: z.number().int().optional(),
  }),
  http: { method: "POST" },
  searchHints: ["compare scenarios", "tradeoff", "side by side"],
  run: async ({ scenarioIds, replications, seed }) => {
    const uniqueIds = [...new Set(scenarioIds)];
    if (uniqueIds.length < 2) fail("Provide at least two distinct scenario ids.", { statusCode: 400 });
    const workspace = await loadWorkspace();
    const scenarios = uniqueIds.map((id) => {
      const scenario = workspace.scenarios.find((candidate) => candidate.id === id);
      if (!scenario) fail(`Unknown scenario “${id}”.`, { statusCode: 404 });
      return scenario;
    });

    const comparisons = [];
    for (const scenario of scenarios) {
      const result = runScenarioToResult(workspace, scenario, replications, seed ?? 20261109);
      const run = await storeRun(scenario, result, workspace);
      comparisons.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        runId: run.id,
        metrics: result.metrics,
      });
    }
    const baseline = comparisons[0];
    if (!baseline) fail("No comparison could be simulated.", { statusCode: 500 });
    return {
      baseline: baseline.scenarioId,
      comparisons: comparisons.map((comparison) => ({
        ...comparison,
        deltas: {
          p95Wait: delta(comparison.metrics.p95Wait, baseline.metrics.p95Wait),
          avgWait: delta(comparison.metrics.avgWait, baseline.metrics.avgWait),
          walkouts: delta(comparison.metrics.walkouts, baseline.metrics.walkouts),
          net: delta(comparison.metrics.net, baseline.metrics.net),
          revenue: delta(comparison.metrics.revenue, baseline.metrics.revenue),
          kitchenP95: delta(comparison.metrics.kitchenP95, baseline.metrics.kitchenP95),
          utilization: delta(comparison.metrics.utilization, baseline.metrics.utilization),
        },
      })),
    };
  },
});
