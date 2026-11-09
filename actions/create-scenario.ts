import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  changesSchema,
  describeChange,
  type Change,
} from "../server/lib/changes.js";
import { loadWorkspace, parseJson } from "../server/lib/workspace.js";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default defineAction({
  description:
    "Create a what-if scenario on top of the live floor. Scenarios can change demand, close the patio, mark staff callouts, and stage layout/staff/menu changes without touching the live plan. Run it with run-scenario to get evidence, then use create-proposal to ask a human to apply it.",
  schema: z.object({
    name: z.string().min(2).max(80).describe("Short scenario name"),
    description: z.string().max(400).default("").describe("What this scenario tests"),
    basedOnScenarioId: z
      .string()
      .optional()
      .describe("Copy demand settings from an existing scenario. Defaults to the Friday baseline."),
    demandProfileId: z.string().optional(),
    demandMultiplier: z.number().min(0.2).max(2).default(1),
    patioClosed: z.boolean().default(false),
    callouts: z
      .array(z.string())
      .default([])
      .describe("Staff ids who are unavailable in this scenario"),
    changes: changesSchema
      .default([])
      .describe("Optional layout, staffing or menu changes applied only in this scenario"),
  }),
  http: { method: "POST" },
  searchHints: ["what if", "scenario", "new plan", "experiment"],
  run: async (args) => {
    const workspace = await loadWorkspace();
    const basedOn = args.basedOnScenarioId
      ? workspace.scenarios.find((scenario) => scenario.id === args.basedOnScenarioId)
      : workspace.scenarios.find((scenario) => scenario.status === "baseline") ??
        workspace.scenarios[0];
    if (args.basedOnScenarioId && !basedOn) {
      fail(`Unknown basedOnScenarioId “${args.basedOnScenarioId}”.`, {
        statusCode: 404,
      });
    }

    const demandProfileId =
      args.demandProfileId ?? basedOn?.demandProfileId ?? workspace.demandProfiles[0]?.id;
    if (!demandProfileId) fail("No demand profile is available to attach to the scenario.", { statusCode: 409 });
    if (!workspace.demandProfiles.some((profile) => profile.id === demandProfileId)) {
      fail(`Unknown demandProfileId “${demandProfileId}”.`, { statusCode: 404 });
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
    for (const staffId of args.callouts) {
      if (!staffIds.has(staffId)) fail(`Callout “${staffId}” is not a staff member.`, { statusCode: 404 });
    }

    const now = new Date().toISOString();
    const id = newId(`scenario-${slug(args.name) || "what-if"}`);
    const inserted = await getDb()
      .insert(schema.scenarios)
      .values({
        id,
        venueId: workspace.venue.id,
        demandProfileId,
        name: args.name,
        description: args.description,
        demandMultiplier: args.demandMultiplier,
        patioClosed: args.patioClosed,
        calloutsJson: JSON.stringify(args.callouts),
        changesJson: JSON.stringify(changes),
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const scenario = inserted[0];
    if (!scenario) fail("Failed to create the scenario.", { statusCode: 500 });

    await getDb().insert(schema.activity).values({
      id: newId("activity"),
      venueId: workspace.venue.id,
      kind: "scenario",
      message: `Created scenario “${scenario.name}” with ${changes.length} change${changes.length === 1 ? "" : "s"}.`,
      actor: "Double Shift",
      metadataJson: JSON.stringify({
        scenarioId: scenario.id,
        changes: changes.map(describeChange),
      }),
      createdAt: now,
    });

    return {
      ...scenario,
      callouts: args.callouts,
      changes: parseJson(scenario.changesJson, []),
      next: `Call run-scenario with scenarioId “${scenario.id}”.`,
    };
  },
});
