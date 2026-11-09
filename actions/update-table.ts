import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

/** UI-ONLY: the operator drags, resizes or takes a table offline. */
export default defineAction({
  uiOnly: true,
  description:
    "Move, resize, activate or take a table offline on the live floor plan. Human-only; the agent must stage a proposal instead.",
  schema: z.object({
    tableId: z.string().min(1),
    x: z.number().min(0).optional(),
    y: z.number().min(0).optional(),
    width: z.number().min(24).max(400).optional(),
    height: z.number().min(24).max(400).optional(),
    seats: z.number().int().min(1).max(20).optional(),
    active: z.boolean().optional(),
    sectionId: z.string().nullable().optional(),
    notes: z.string().max(400).nullable().optional(),
  }),
  http: { method: "POST" },
  searchHints: ["move table", "floor plan", "seats"],
  run: async (args) => {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(schema.diningTables)
      .where(eq(schema.diningTables.id, args.tableId))
      .limit(1);
    if (!existing) fail(`Table “${args.tableId}” does not exist.`, { statusCode: 404 });

    const patch: Partial<typeof schema.diningTables.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (args.x !== undefined) patch.x = args.x;
    if (args.y !== undefined) patch.y = args.y;
    if (args.width !== undefined) patch.width = args.width;
    if (args.height !== undefined) patch.height = args.height;
    if (args.seats !== undefined) patch.seats = args.seats;
    if (args.active !== undefined) patch.active = args.active;
    if (args.sectionId !== undefined) patch.sectionId = args.sectionId;
    if (args.notes !== undefined) patch.notes = args.notes;

    const [table] = await db
      .update(schema.diningTables)
      .set(patch)
      .where(eq(schema.diningTables.id, args.tableId))
      .returning();
    return { table };
  },
});
