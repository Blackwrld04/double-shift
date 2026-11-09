import { defineAction, fail } from "@agent-native/core/action";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { getActiveVenueContext } from "../server/lib/workspace.js";

export default defineAction({
  description:
    "Add a new dining table to the restaurant floor plan with specified seats, shape, section, and coordinates.",
  schema: z.object({
    floorId: z
      .string()
      .optional()
      .describe("Floor ID. If omitted, uses the active venue's floor."),
    sectionId: z
      .string()
      .optional()
      .describe("Section ID (e.g. Main Room, Patio, Bar). If omitted, uses the first available section."),
    label: z
      .string()
      .optional()
      .describe("Table label (e.g. 'T09', 'P03'). If omitted, automatically generates the next sequential number."),
    seats: z
      .coerce.number()
      .int()
      .min(1)
      .max(20)
      .default(4)
      .describe("Number of seats at this table (1 to 20). Defaults to 4."),
    shape: z
      .enum(["round", "rect"])
      .default("rect")
      .describe("Table shape: 'round' or 'rect'. Defaults to 'rect'."),
    x: z
      .number()
      .min(0)
      .max(1200)
      .optional()
      .describe("X position on the floor canvas (0 to 1200). Defaults to open space."),
    y: z
      .number()
      .min(0)
      .max(760)
      .optional()
      .describe("Y position on the floor canvas (0 to 760). Defaults to open space."),
    width: z
      .number()
      .min(24)
      .max(400)
      .optional()
      .describe("Table width in pixels. Inferred from shape/seats if omitted."),
    height: z
      .number()
      .min(24)
      .max(400)
      .optional()
      .describe("Table height in pixels. Inferred from shape/seats if omitted."),
    notes: z.string().max(400).optional().describe("Operator notes"),
  }),
  http: { method: "POST" },
  searchHints: ["add table", "create table", "new table", "floor plan"],
  run: async (args) => {
    const db = getDb();
    const nowIso = new Date().toISOString();

    let targetFloorId = args.floorId;
    if (!targetFloorId) {
      const { venueId } = await getActiveVenueContext();
      const [floor] = await db
        .select()
        .from(schema.floors)
        .where(eq(schema.floors.venueId, venueId))
        .limit(1);
      if (!floor) {
        const [anyFloor] = await db.select().from(schema.floors).limit(1);
        if (!anyFloor) fail("No floor found in this venue.", { statusCode: 404 });
        targetFloorId = anyFloor.id;
      } else {
        targetFloorId = floor.id;
      }
    }

    // Resolve section
    let targetSectionId: string | null = args.sectionId ?? null;
    if (!targetSectionId) {
      const [firstSection] = await db
        .select()
        .from(schema.sections)
        .where(eq(schema.sections.floorId, targetFloorId))
        .limit(1);
      targetSectionId = firstSection?.id ?? null;
    }

    // Resolve label
    const existingTables = await db
      .select({ label: schema.diningTables.label })
      .from(schema.diningTables)
      .where(eq(schema.diningTables.floorId, targetFloorId));

    let label = args.label?.trim();
    if (!label) {
      const numbers = existingTables
        .map((t) => {
          const match = t.label.match(/\d+/);
          return match ? Number.parseInt(match[0], 10) : 0;
        })
        .filter((n) => !Number.isNaN(n));
      const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      label = `T${String(nextNum).padStart(2, "0")}`;
    }

    // Determine default dimensions
    const seats = args.seats ?? 4;
    const shape = args.shape ?? (seats <= 2 ? "round" : "rect");
    let width = args.width;
    let height = args.height;
    if (!width || !height) {
      if (shape === "round") {
        const dim = seats <= 2 ? 76 : 96;
        width = width ?? dim;
        height = height ?? dim;
      } else {
        if (seats <= 2) {
          width = width ?? 76;
          height = height ?? 76;
        } else if (seats <= 4) {
          width = width ?? 96;
          height = height ?? 96;
        } else {
          width = width ?? 128;
          height = height ?? 92;
        }
      }
    }

    // Find position if not provided
    const posX =
      args.x ??
      clamp(150 + (existingTables.length % 5) * 110, 50, 1000);
    const posY =
      args.y ??
      clamp(180 + Math.floor(existingTables.length / 5) * 120, 100, 600);

    const tableId = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const [table] = await db
      .insert(schema.diningTables)
      .values({
        id: tableId,
        floorId: targetFloorId,
        sectionId: targetSectionId,
        label,
        x: posX,
        y: posY,
        width,
        height,
        shape,
        seats,
        active: true,
        notes: args.notes ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning();

    return { table };
  },
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
