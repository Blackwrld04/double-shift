import { defineAction, fail } from "@agent-native/core/action";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  changesSchema,
  describeChange,
  type Change,
} from "../server/lib/changes.js";
import { loadWorkspace, parseJson } from "../server/lib/workspace.js";

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export type ExpectedSummary = {
  runId: string;
  scenarioId: string;
  scenarioName: string;
  p95Wait: number;
  avgWait: number;
  walkouts: number;
  net: number;
  revenue: number;
  kitchenP95: number;
  utilization: number;
  replications: number;
  range?: unknown;
};

export default defineAction({
  description:
    "Stage a human-approval proposal. Requires a scenario that has already been simulated: the expected outcome is copied from the latest stored run, never invented. The agent can stage proposals but cannot apply them; a human presses Apply in the UI.",
  schema: z.object({
    title: z.string().min(2).max(100),
    summary: z.string().max(800).default("").describe("Plain-language rationale for the human"),
    scenarioId: z.string().min(1).describe("The simulated scenario this proposal implements"),
    runId: z.string().optional().describe("Specific run to cite; defaults to the latest run for the scenario"),
    changes: changesSchema,
    note: z.string().max(400).optional(),
  }),
  http: { method: "POST" },
  searchHints: ["proposal", "stage change", "human approval", "recommend"],
  run: async (args, ctx) => {
    const workspace = await loadWorkspace();
    const scenario = workspace.scenarios.find((candidate) => candidate.id === args.scenarioId);
    if (!scenario) fail(`Unknown scenario “${args.scenarioId}”.`, { statusCode: 404 });

    const db = getDb();
    const [run] = args.runId
      ? await db
          .select()
          .from(schema.runs)
          .where(and(eq(schema.runs.id, args.runId), eq(schema.runs.scenarioId, scenario.id)))
          .limit(1)
      : await db
          .select()
          .from(schema.runs)
          .where(eq(schema.runs.scenarioId, scenario.id))
          .orderBy(desc(schema.runs.createdAt))
          .limit(1);
    if (!run) {
      fail(
        `Scenario “${scenario.name}” has no run yet. Call run-scenario, then stage the proposal with the runId it returns.`,
        { statusCode: 409 },
      );
    }

    const changes = args.changes as Change[];
    const tableIds = new Set(workspace.tables.map((table) => table.id));
    const staffIds = new Set(workspace.staff.map((member) => member.id));
    const menuIds = new Set(workspace.menu.map((item) => item.id));
    for (const change of changes) {
      if (change.kind === "table" && !tableIds.has(change.tableId)) {
        fail(`Table “${change.tableId}” does not exist.`, { statusCode: 404 });
      }
      if (change.kind === "staff" && !staffIds.has(change.staffId)) {
        fail(`Staff member “${change.staffId}” does not exist.`, { statusCode: 404 });
      }
      if (change.kind === "menu" && !menuIds.has(change.itemId)) {
        fail(`Menu item “${change.itemId}” does not exist.`, { statusCode: 404 });
      }
    }

    const metrics = parseJson<Record<string, unknown>>(run.metricsJson, {});
    const expected: ExpectedSummary = {
      runId: run.id,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      p95Wait: Number(metrics.p95Wait ?? 0),
      avgWait: Number(metrics.avgWait ?? 0),
      walkouts: Number(metrics.walkouts ?? 0),
      net: Number(metrics.net ?? 0),
      revenue: Number(metrics.revenue ?? 0),
      kitchenP95: Number(metrics.kitchenP95 ?? 0),
      utilization: Number(metrics.utilization ?? 0),
      replications: Number(metrics.replications ?? 0),
      range: metrics.range,
    };

    const now = new Date().toISOString();
    const id = newId("proposal");
    const inserted = await db
      .insert(schema.proposals)
      .values({
        id,
        venueId: workspace.venue.id,
        scenarioId: scenario.id,
        runId: run.id,
        title: args.title,
        summary: args.summary,
        changesJson: JSON.stringify(changes),
        expectedJson: JSON.stringify(expected),
        status: "staged",
        createdBy: ctx?.caller === "frontend" ? "human" : "agent",
        createdAt: now,
        note: args.note ?? null,
      })
      .returning();
    const proposal = inserted[0];
    if (!proposal) fail("Failed to stage the proposal.", { statusCode: 500 });

    await db.insert(schema.activity).values({
      id: newId("activity"),
      venueId: workspace.venue.id,
      kind: "proposal",
      message: `Staged proposal “${proposal.title}” with ${changes.length} change${changes.length === 1 ? "" : "s"}. Waiting for human approval.`,
      actor: ctx?.caller === "frontend" ? "Operator" : "Double Shift agent",
      metadataJson: JSON.stringify({
        proposalId: proposal.id,
        scenarioId: scenario.id,
        runId: run.id,
        changes: changes.map(describeChange),
      }),
      createdAt: now,
    });

    return {
      ...proposal,
      changes,
      expected,
      next: "A human must press Apply in the proposal dock. The agent cannot apply live changes.",
    };
  },
});
