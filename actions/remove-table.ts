import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description:
    "Remove (delete) a dining table from the restaurant floor plan.",
  schema: z.object({
    tableId: z.string().min(1).describe("The ID of the dining table to delete/remove"),
  }),
  http: { method: "POST" },
  searchHints: ["delete table", "remove table", "clear table", "floor plan"],
  run: async ({ tableId }) => {
    const db = getDb();
    const [existing] = await db
      .select({ id: schema.diningTables.id, label: schema.diningTables.label })
      .from(schema.diningTables)
      .where(eq(schema.diningTables.id, tableId))
      .limit(1);

    if (!existing) {
      fail(`Table “${tableId}” was not found on the floor plan.`, { statusCode: 404 });
    }

    await db
      .delete(schema.diningTables)
      .where(eq(schema.diningTables.id, tableId));

    return {
      ok: true,
      tableId,
      label: existing.label,
    };
  },
});

