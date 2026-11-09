import {
  boolean,
  doublePrecision,
  index,
  integer,
  now,
  table,
  text,
} from "@agent-native/core/db/schema";

/**
 * Double Shift data model.
 *
 * The floor plan is the spatial source of truth. A scenario is an overlay on
 * top of the live venue: demand profile + staffing overrides + layout snapshot.
 * Every simulation run stores its inputs, metrics, timeline and event log so
 * the agent can cite evidence instead of inventing numbers.
 */

export const venues = table("ds_venues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  currency: text("currency").notNull().default("USD"),
  address: text("address"),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});

export const floors = table("ds_floors", {
  id: text("id").primaryKey(),
  venueId: text("venue_id").notNull(),
  name: text("name").notNull(),
  width: integer("width").notNull().default(1200),
  height: integer("height").notNull().default(760),
  createdAt: text("created_at").notNull().default(now()),
});

export const sections = table("ds_sections", {
  id: text("id").primaryKey(),
  floorId: text("floor_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#ffffff"),
  createdAt: text("created_at").notNull().default(now()),
});

export const diningTables = table(
  "ds_tables",
  {
    id: text("id").primaryKey(),
    floorId: text("floor_id").notNull(),
    sectionId: text("section_id"),
    label: text("label").notNull(),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    width: doublePrecision("width").notNull().default(88),
    height: doublePrecision("height").notNull().default(88),
    shape: text("shape").notNull().default("round"),
    seats: integer("seats").notNull().default(4),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
  },
  (table) => ({
    floorIdx: index("ds_tables_floor_idx").on(table.floorId),
    sectionIdx: index("ds_tables_section_idx").on(table.sectionId),
  }),
);

export const stations = table("ds_stations", {
  id: text("id").primaryKey(),
  floorId: text("floor_id").notNull(),
  kind: text("kind").notNull().default("pass"),
  label: text("label").notNull(),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  width: doublePrecision("width").notNull().default(130),
  height: doublePrecision("height").notNull().default(54),
  capacity: integer("capacity").notNull().default(1),
  createdAt: text("created_at").notNull().default(now()),
});

export const staff = table(
  "ds_staff",
  {
    id: text("id").primaryKey(),
    venueId: text("venue_id").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("server"),
    station: text("station"),
    sectionId: text("section_id"),
    shiftStart: text("shift_start").notNull().default("16:30"),
    shiftEnd: text("shift_end").notNull().default("23:00"),
    hourlyRate: doublePrecision("hourly_rate").notNull().default(24),
    maxTables: integer("max_tables").notNull().default(4),
    maxSeats: integer("max_seats").notNull().default(18),
    active: boolean("active").notNull().default(true),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
  },
  (table) => ({
    venueIdx: index("ds_staff_venue_idx").on(table.venueId),
  }),
);

export const menuItems = table("ds_menu_items", {
  id: text("id").primaryKey(),
  venueId: text("venue_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("main"),
  station: text("station").notNull().default("saute"),
  prepMinutes: doublePrecision("prep_minutes").notNull().default(4),
  cookMinutes: doublePrecision("cook_minutes").notNull().default(8),
  price: doublePrecision("price").notNull().default(24),
  margin: doublePrecision("margin").notNull().default(0.68),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull().default(now()),
});

export const demandProfiles = table("ds_demand_profiles", {
  id: text("id").primaryKey(),
  venueId: text("venue_id").notNull(),
  name: text("name").notNull(),
  dayOfWeek: text("day_of_week").notNull().default("friday"),
  startTime: text("start_time").notNull().default("17:00"),
  endTime: text("end_time").notNull().default("22:30"),
  covers: integer("covers").notNull().default(180),
  curveJson: text("curve_json").notNull().default("[]"),
  partyMixJson: text("party_mix_json").notNull().default("{}"),
  noShowRate: doublePrecision("no_show_rate").notNull().default(0.06),
  walkoutThresholdMin: integer("walkout_threshold_min").notNull().default(28),
  weather: text("weather").notNull().default("clear"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(now()),
});

export const scenarios = table(
  "ds_scenarios",
  {
    id: text("id").primaryKey(),
    venueId: text("venue_id").notNull(),
    demandProfileId: text("demand_profile_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    demandMultiplier: doublePrecision("demand_multiplier")
      .notNull()
      .default(1),
    patioClosed: boolean("patio_closed").notNull().default(false),
    calloutsJson: text("callouts_json").notNull().default("[]"),
    changesJson: text("changes_json").notNull().default("[]"),
    status: text("status").notNull().default("draft"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
  },
  (table) => ({
    venueIdx: index("ds_scenarios_venue_idx").on(table.venueId),
  }),
);

export const runs = table(
  "ds_runs",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id").notNull(),
    venueId: text("venue_id").notNull(),
    seed: integer("seed").notNull(),
    replications: integer("replications").notNull().default(25),
    status: text("status").notNull().default("complete"),
    metricsJson: text("metrics_json").notNull().default("{}"),
    timelineJson: text("timeline_json").notNull().default("[]"),
    eventsJson: text("events_json").notNull().default("[]"),
    snapshotJson: text("snapshot_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(now()),
  },
  (table) => ({
    scenarioIdx: index("ds_runs_scenario_idx").on(
      table.scenarioId,
      table.createdAt,
    ),
    venueIdx: index("ds_runs_venue_idx").on(table.venueId),
  }),
);

export const proposals = table(
  "ds_proposals",
  {
    id: text("id").primaryKey(),
    venueId: text("venue_id").notNull(),
    scenarioId: text("scenario_id"),
    runId: text("run_id"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    changesJson: text("changes_json").notNull().default("[]"),
    expectedJson: text("expected_json").notNull().default("{}"),
    status: text("status").notNull().default("staged"),
    createdBy: text("created_by").notNull().default("agent"),
    createdAt: text("created_at").notNull().default(now()),
    resolvedAt: text("resolved_at"),
    resolvedBy: text("resolved_by"),
    note: text("note"),
  },
  (table) => ({
    venueIdx: index("ds_proposals_venue_idx").on(
      table.venueId,
      table.status,
      table.createdAt,
    ),
  }),
);

export const activity = table("ds_activity", {
  id: text("id").primaryKey(),
  venueId: text("venue_id").notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  actor: text("actor").notNull().default("system"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(now()),
});
