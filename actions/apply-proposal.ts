import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  describeChange,
  type Change,
} from "../server/lib/changes.js";
import { parseJson } from "../server/lib/workspace.js";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * UI-ONLY. The agent may stage proposals but a human must press Apply. This is
 * the single write path from a staged proposal to the live floor.
 */
export default defineAction({
  uiOnly: true,
  description:
    "Apply a staged proposal to the live floor plan, staff roster and menu. This action is human-only and cannot be called by the agent.",
  schema: z.object({
    proposalId: z.string().min(1),
    note: z.string().max(400).optional(),
  }),
  http: { method: "POST" },
  searchHints: ["apply proposal", "approve change", "human approval"],
  run: async ({ proposalId, note }, ctx) => {
    const db = getDb();
    const [proposal] = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, proposalId))
      .limit(1);
    if (!proposal) fail(`No proposal found with id “${proposalId}”.`, { statusCode: 404 });
    if (proposal.status !== "staged") {
      fail(`Proposal is already ${proposal.status}. Only staged proposals can be applied.`, {
        statusCode: 409,
      });
    }

    const changes = parseJson<Change[]>(proposal.changesJson, []);
    if (changes.length === 0) fail("Proposal has no changes to apply.", { statusCode: 409 });

    // Stale-proposal guard: every row a change points at must still exist,
    // otherwise the update would silently match zero rows and we would mark the
    // proposal as applied. Check everything before writing anything.
    const [liveTables, liveStaff, liveMenu] = await Promise.all([
      db.select({ id: schema.diningTables.id }).from(schema.diningTables),
      db.select({ id: schema.staff.id }).from(schema.staff),
      db.select({ id: schema.menuItems.id }).from(schema.menuItems),
    ]);
    const tableIds = new Set(liveTables.map((row) => row.id));
    const staffIds = new Set(liveStaff.map((row) => row.id));
    const menuIds = new Set(liveMenu.map((row) => row.id));
    const missing: string[] = [];
    for (const change of changes) {
      if (change.kind === "table" && !tableIds.has(change.tableId)) missing.push(change.tableId);
      else if (change.kind === "staff" && !staffIds.has(change.staffId)) missing.push(change.staffId);
      else if (change.kind === "menu" && !menuIds.has(change.itemId)) missing.push(change.itemId);
    }
    if (missing.length > 0) {
      fail(
        `This proposal is out of date: ${missing.join(", ")} no longer exist${missing.length === 1 ? "s" : ""}. Reject it and ask the agent to stage a new one.`,
        { statusCode: 409 },
      );
    }

    const now = new Date().toISOString();
    const applied: string[] = [];

    for (const change of changes) {
      if (change.kind === "table") {
        const patch: Partial<typeof schema.diningTables.$inferInsert> = {
          updatedAt: now,
        };
        if (change.active !== undefined) patch.active = change.active;
        if (change.seats !== undefined) patch.seats = change.seats;
        if (change.x !== undefined) patch.x = change.x;
        if (change.y !== undefined) patch.y = change.y;
        if (change.sectionId !== undefined) patch.sectionId = change.sectionId;
        await db
          .update(schema.diningTables)
          .set(patch)
          .where(eq(schema.diningTables.id, change.tableId));
      } else if (change.kind === "staff") {
        const patch: Partial<typeof schema.staff.$inferInsert> = { updatedAt: now };
        if (change.active !== undefined) patch.active = change.active;
        if (change.role !== undefined) patch.role = change.role;
        if (change.station !== undefined) patch.station = change.station;
        if (change.sectionId !== undefined) patch.sectionId = change.sectionId;
        if (change.shiftStart !== undefined) patch.shiftStart = change.shiftStart;
        if (change.shiftEnd !== undefined) patch.shiftEnd = change.shiftEnd;
        if (change.hourlyRate !== undefined) patch.hourlyRate = change.hourlyRate;
        if (change.maxTables !== undefined) patch.maxTables = change.maxTables;
        if (change.maxSeats !== undefined) patch.maxSeats = change.maxSeats;
        await db.update(schema.staff).set(patch).where(eq(schema.staff.id, change.staffId));
      } else if (change.kind === "add-staff") {
        const base = `staff-${slug(change.name) || "new-hire"}`;
        let id = base;
        let suffix = 2;
        while (
          (await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.id, id)).limit(1))
            .length > 0
        ) {
          id = `${base}-${suffix}`;
          suffix += 1;
        }
        await db.insert(schema.staff).values({
          id,
          venueId: proposal.venueId,
          name: change.name,
          role: change.role,
          station: change.station ?? null,
          sectionId: change.sectionId ?? null,
          shiftStart: change.shiftStart,
          shiftEnd: change.shiftEnd,
          hourlyRate: change.hourlyRate,
          maxTables: change.maxTables,
          maxSeats: change.maxSeats,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      } else if (change.kind === "menu") {
        const patch: Partial<typeof schema.menuItems.$inferInsert> = {};
        if (change.active !== undefined) patch.active = change.active;
        if (change.station !== undefined) patch.station = change.station;
        if (change.prepMinutes !== undefined) patch.prepMinutes = change.prepMinutes;
        if (change.cookMinutes !== undefined) patch.cookMinutes = change.cookMinutes;
        await db
          .update(schema.menuItems)
          .set(patch)
          .where(eq(schema.menuItems.id, change.itemId));
      }
      applied.push(describeChange(change));
    }

    const updatedRows = await db
      .update(schema.proposals)
      .set({
        status: "applied",
        resolvedAt: now,
        resolvedBy: ctx?.userEmail ?? "human",
        note: note ?? proposal.note,
      })
      .where(eq(schema.proposals.id, proposal.id))
      .returning();
    const updated = updatedRows[0];
    if (!updated) fail("Failed to update the proposal.", { statusCode: 500 });

    await db.insert(schema.activity).values({
      id: newId("activity"),
      venueId: proposal.venueId,
      kind: "apply",
      message: `Applied proposal “${proposal.title}”: ${applied.length} live change${applied.length === 1 ? "" : "s"}.`,
      actor: "Operator",
      metadataJson: JSON.stringify({ proposalId: proposal.id, applied }),
      createdAt: now,
    });

    return {
      proposal: {
        ...updated,
        changes: parseJson(updated.changesJson, []),
        expected: parseJson(updated.expectedJson, {}),
      },
      applied,
    };
  },
});
