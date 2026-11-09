import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Move, reposition, resize, activate, or update seats and section of a table on the floor plan.",
  schema: z.object({
    tableId: z.string().min(1).describe("The ID of the table to reposition or update"),
    x: z.number().min(0).optional().describe("X coordinate on the floor plan (0 to 1200)"),
    y: z.number().min(0).optional().describe("Y coordinate on the floor plan (0 to 760)"),
    width: z.number().min(24).max(400).optional().describe("Table width in pixels"),
    height: z.number().min(24).max(400).optional().describe("Table height in pixels"),
    seats: z.number().int().min(1).max(20).optional().describe("Seat capacity of the table (1 to 20)"),
    active: z.boolean().optional().describe("Whether the table is active and available for seating"),
    sectionId: z.string().nullable().optional().describe("Section ID the table belongs to"),
    notes: z.string().max(400).nullable().optional().describe("Operator notes for the table"),
  }),
  http: { method: "POST" },
  searchHints: ["move table", "reposition table", "floor plan", "seats"],
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
