import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { parseJson } from "../server/lib/workspace.js";

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * UI-ONLY. Rejecting is a human decision; the agent must not be able to clear
 * its own proposals out of the dock.
 */
export default defineAction({
  uiOnly: true,
  description:
    "Reject a staged proposal with an optional note. This action is human-only and cannot be called by the agent.",
  schema: z.object({
    proposalId: z.string().min(1),
    note: z.string().max(400).optional(),
  }),
  http: { method: "POST" },
  searchHints: ["reject proposal", "decline change"],
  run: async ({ proposalId, note }, ctx) => {
    const db = getDb();
    const [proposal] = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, proposalId))
      .limit(1);
    if (!proposal) fail(`No proposal found with id “${proposalId}”.`, { statusCode: 404 });
    if (proposal.status !== "staged") {
      fail(`Proposal is already ${proposal.status}. Only staged proposals can be rejected.`, {
        statusCode: 409,
      });
    }

    const now = new Date().toISOString();
    const updatedRows = await db
      .update(schema.proposals)
      .set({
        status: "rejected",
        resolvedAt: now,
        resolvedBy: ctx?.userEmail ?? "human",
        note: note ?? null,
      })
      .where(eq(schema.proposals.id, proposal.id))
      .returning();
    const updated = updatedRows[0];
    if (!updated) fail("Failed to update the proposal.", { statusCode: 500 });

    await db.insert(schema.activity).values({
      id: newId("activity"),
      venueId: proposal.venueId,
      kind: "reject",
      message: `Rejected proposal “${proposal.title}”${note ? `: ${note}` : ""}.`,
      actor: "Operator",
      metadataJson: JSON.stringify({ proposalId: proposal.id }),
      createdAt: now,
    });

    return {
      proposal: {
        ...updated,
        changes: parseJson(updated.changesJson, []),
        expected: parseJson(updated.expectedJson, {}),
      },
    };
  },
});
