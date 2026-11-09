import { z } from "zod";

/**
 * A single proposed or scenario-scoped change.
 *
 * The same shape flows through three places:
 *  - `create-scenario` stages it in a what-if scenario,
 *  - `create-proposal` records it as a human-approval gate,
 *  - `apply-proposal` (UI-only) writes it to the live floor.
 *
 * Keeping one schema means the agent cannot describe a change it cannot also
 * simulate.
 */
export const tableChangeSchema = z.object({
  kind: z.literal("table"),
  tableId: z.string().min(1),
  active: z.boolean().optional(),
  seats: z.number().int().min(1).max(20).optional(),
  x: z.number().min(0).optional(),
  y: z.number().min(0).optional(),
  sectionId: z.string().nullable().optional(),
});

export const staffChangeSchema = z.object({
  kind: z.literal("staff"),
  staffId: z.string().min(1),
  active: z.boolean().optional(),
  role: z.string().optional(),
  station: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  hourlyRate: z.number().min(0).optional(),
  maxTables: z.number().int().min(0).max(20).optional(),
  maxSeats: z.number().int().min(0).max(60).optional(),
});

export const addStaffChangeSchema = z.object({
  kind: z.literal("add-staff"),
  name: z.string().min(1),
  role: z.string().default("server"),
  station: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  shiftStart: z.string().default("17:00"),
  shiftEnd: z.string().default("23:00"),
  hourlyRate: z.number().min(0).default(24),
  maxTables: z.number().int().min(0).max(20).default(4),
  maxSeats: z.number().int().min(0).max(60).default(18),
});

export const menuChangeSchema = z.object({
  kind: z.literal("menu"),
  itemId: z.string().min(1),
  active: z.boolean().optional(),
  station: z.string().optional(),
  prepMinutes: z.number().min(0).max(120).optional(),
  cookMinutes: z.number().min(0).max(180).optional(),
});

export const changeSchema = z.discriminatedUnion("kind", [
  tableChangeSchema,
  staffChangeSchema,
  addStaffChangeSchema,
  menuChangeSchema,
]);

export const changesSchema = z.array(changeSchema).min(1).max(60);

export type Change = z.infer<typeof changeSchema>;
export type TableChange = z.infer<typeof tableChangeSchema>;
export type StaffChange = z.infer<typeof staffChangeSchema>;
export type AddStaffChange = z.infer<typeof addStaffChangeSchema>;
export type MenuChange = z.infer<typeof menuChangeSchema>;

type SimLikeTable = {
  id: string;
  sectionId: string | null;
  seats: number;
  active: boolean;
  x: number;
  y: number;
};

type SimLikeStaff = {
  id: string;
  name: string;
  role: string;
  station: string | null;
  sectionId: string | null;
  shiftStart: string;
  shiftEnd: string;
  hourlyRate: number;
  maxTables: number;
  maxSeats: number;
  active: boolean;
};

type SimLikeMenu = {
  id: string;
  station: string;
  prepMinutes: number;
  cookMinutes: number;
  active: boolean;
};

export type SimOverrides = {
  tables: SimLikeTable[];
  staff: SimLikeStaff[];
  menu: SimLikeMenu[];
};

/**
 * Apply changes to an in-memory copy of the workspace for simulation. Unknown
 * ids are skipped rather than throwing so one stale change cannot invalidate an
 * entire scenario run; the proposal validator reports missing ids when the
 * agent stages a change.
 */
export function applyChangesToSim<T extends SimOverrides>(base: T, changes: Change[]): T {
  const tables = base.tables.map((table) => ({ ...table }));
  const staff = base.staff.map((member) => ({ ...member }));
  const menu = base.menu.map((item) => ({ ...item }));

  for (const change of changes) {
    if (change.kind === "table") {
      const table = tables.find((candidate) => candidate.id === change.tableId);
      if (!table) continue;
      if (change.active !== undefined) table.active = change.active;
      if (change.seats !== undefined) table.seats = change.seats;
      if (change.x !== undefined) table.x = change.x;
      if (change.y !== undefined) table.y = change.y;
      if (change.sectionId !== undefined) table.sectionId = change.sectionId;
    } else if (change.kind === "staff") {
      const member = staff.find((candidate) => candidate.id === change.staffId);
      if (!member) continue;
      if (change.active !== undefined) member.active = change.active;
      if (change.role !== undefined) member.role = change.role;
      if (change.station !== undefined) member.station = change.station;
      if (change.sectionId !== undefined) member.sectionId = change.sectionId;
      if (change.shiftStart !== undefined) member.shiftStart = change.shiftStart;
      if (change.shiftEnd !== undefined) member.shiftEnd = change.shiftEnd;
      if (change.hourlyRate !== undefined) member.hourlyRate = change.hourlyRate;
      if (change.maxTables !== undefined) member.maxTables = change.maxTables;
      if (change.maxSeats !== undefined) member.maxSeats = change.maxSeats;
    } else if (change.kind === "add-staff") {
      const id = `staff-${change.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (staff.some((candidate) => candidate.id === id)) continue;
      staff.push({
        id,
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
      });
    } else if (change.kind === "menu") {
      const item = menu.find((candidate) => candidate.id === change.itemId);
      if (!item) continue;
      if (change.active !== undefined) item.active = change.active;
      if (change.station !== undefined) item.station = change.station;
      if (change.prepMinutes !== undefined) item.prepMinutes = change.prepMinutes;
      if (change.cookMinutes !== undefined) item.cookMinutes = change.cookMinutes;
    }
  }

  return { ...base, tables, staff, menu };
}

export function describeChange(change: Change): string {
  switch (change.kind) {
    case "table":
      return `Table ${change.tableId}: ${[
        change.active !== undefined ? (change.active ? "activate" : "take offline") : null,
        change.seats !== undefined ? `${change.seats} seats` : null,
        change.x !== undefined || change.y !== undefined ? "move" : null,
        change.sectionId !== undefined ? `section ${change.sectionId ?? "none"}` : null,
      ]
        .filter(Boolean)
        .join(", ")}`;
    case "staff":
      return `Staff ${change.staffId}: ${[
        change.active !== undefined ? (change.active ? "active" : "call out") : null,
        change.shiftStart && change.shiftEnd
          ? `${change.shiftStart}–${change.shiftEnd}`
          : null,
        change.maxTables !== undefined ? `${change.maxTables} tables` : null,
        change.maxSeats !== undefined ? `${change.maxSeats} seats` : null,
        change.station !== undefined ? `station ${change.station ?? "none"}` : null,
      ]
        .filter(Boolean)
        .join(", ")}`;
    case "add-staff":
      return `Add ${change.role} ${change.name} (${change.shiftStart}–${change.shiftEnd})`;
    case "menu":
      return `Menu ${change.itemId}: ${[
        change.active !== undefined ? (change.active ? "on" : "off") : null,
        change.station !== undefined ? change.station : null,
        change.prepMinutes !== undefined || change.cookMinutes !== undefined
          ? "retime"
          : null,
      ]
        .filter(Boolean)
        .join(", ")}`;
    default:
      return "Change";
  }
}
