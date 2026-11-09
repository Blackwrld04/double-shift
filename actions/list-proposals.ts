import { defineAction } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { parseJson } from "../server/lib/workspace.js";
import { VENUE_ID } from "../server/lib/seed.js";

export default defineAction({
  description:
    "List proposals staged for human approval, newest first. Use this to check whether a proposal is still pending, already applied, or was rejected before staging another one.",
  schema: z.object({
    status: z
      .enum(["staged", "applied", "rejected", "all"])
      .default("staged")
      .describe("Filter by proposal status"),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  http: { method: "GET" },
  readOnly: true,
  searchHints: ["proposals", "pending approval", "staged changes"],
  run: async ({ status, limit }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.venueId, VENUE_ID));
    const filtered = rows
      .filter((proposal) => status === "all" || proposal.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
    return {
      proposals: filtered.map((proposal) => ({
        ...proposal,
        changes: parseJson(proposal.changesJson, []),
        expected: parseJson(proposal.expectedJson, {}),
      })),
      counts: {
        staged: rows.filter((proposal) => proposal.status === "staged").length,
        applied: rows.filter((proposal) => proposal.status === "applied").length,
        rejected: rows.filter((proposal) => proposal.status === "rejected").length,
      },
    };
  },
});
