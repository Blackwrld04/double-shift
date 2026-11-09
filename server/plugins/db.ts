import { runMigrations } from "@agent-native/core/db";

/**
 * App-owned migrations. Never edit a migration that has already run; append a
 * new version instead.
 */
export default runMigrations(
  [
    {
      version: 1,
      name: "double-shift-core",
      sql: `
CREATE TABLE IF NOT EXISTS ds_venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  currency TEXT NOT NULL DEFAULT 'USD',
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS ds_floors (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 1200,
  height INTEGER NOT NULL DEFAULT 760,
  created_at TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS ds_sections (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#e8683f',
  created_at TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS ds_tables (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL,
  section_id TEXT,
  label TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  width DOUBLE PRECISION NOT NULL DEFAULT 88,
  height DOUBLE PRECISION NOT NULL DEFAULT 88,
  shape TEXT NOT NULL DEFAULT 'round',
  seats INTEGER NOT NULL DEFAULT 4,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS ds_tables_floor_idx ON ds_tables (floor_id);
CREATE INDEX IF NOT EXISTS ds_tables_section_idx ON ds_tables (section_id);

CREATE TABLE IF NOT EXISTS ds_stations (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pass',
  label TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  width DOUBLE PRECISION NOT NULL DEFAULT 130,
  height DOUBLE PRECISION NOT NULL DEFAULT 54,
  capacity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS ds_staff (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'server',
  section_id TEXT,
  shift_start TEXT NOT NULL DEFAULT '16:30',
  shift_end TEXT NOT NULL DEFAULT '23:00',
  hourly_rate DOUBLE PRECISION NOT NULL DEFAULT 24,
  max_tables INTEGER NOT NULL DEFAULT 4,
  max_seats INTEGER NOT NULL DEFAULT 18,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS ds_staff_venue_idx ON ds_staff (venue_id);

CREATE TABLE IF NOT EXISTS ds_menu_items (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'main',
  station TEXT NOT NULL DEFAULT 'saute',
  prep_minutes DOUBLE PRECISION NOT NULL DEFAULT 4,
  cook_minutes DOUBLE PRECISION NOT NULL DEFAULT 8,
  price DOUBLE PRECISION NOT NULL DEFAULT 24,
  margin DOUBLE PRECISION NOT NULL DEFAULT 0.68,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS ds_demand_profiles (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  day_of_week TEXT NOT NULL DEFAULT 'friday',
  start_time TEXT NOT NULL DEFAULT '17:00',
  end_time TEXT NOT NULL DEFAULT '22:30',
  covers INTEGER NOT NULL DEFAULT 180,
  curve_json TEXT NOT NULL DEFAULT '[]',
  party_mix_json TEXT NOT NULL DEFAULT '{}',
  no_show_rate DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  walkout_threshold_min INTEGER NOT NULL DEFAULT 28,
  weather TEXT NOT NULL DEFAULT 'clear',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS ds_scenarios (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  demand_profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  demand_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
  patio_closed BOOLEAN NOT NULL DEFAULT false,
  callouts_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS ds_scenarios_venue_idx ON ds_scenarios (venue_id);

CREATE TABLE IF NOT EXISTS ds_runs (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  replications INTEGER NOT NULL DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'complete',
  metrics_json TEXT NOT NULL DEFAULT '{}',
  timeline_json TEXT NOT NULL DEFAULT '[]',
  events_json TEXT NOT NULL DEFAULT '[]',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS ds_runs_scenario_idx ON ds_runs (scenario_id, created_at);
CREATE INDEX IF NOT EXISTS ds_runs_venue_idx ON ds_runs (venue_id);

CREATE TABLE IF NOT EXISTS ds_proposals (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  scenario_id TEXT,
  run_id TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  changes_json TEXT NOT NULL DEFAULT '[]',
  expected_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'staged',
  created_by TEXT NOT NULL DEFAULT 'agent',
  created_at TEXT NOT NULL DEFAULT (now()),
  resolved_at TEXT,
  resolved_by TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS ds_proposals_venue_idx ON ds_proposals (venue_id, status, created_at);

CREATE TABLE IF NOT EXISTS ds_activity (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (now())
);
`,
    },
    {
      version: 2,
      name: "staff-station",
      sql: `ALTER TABLE ds_staff ADD COLUMN IF NOT EXISTS station TEXT;`,
    },
    {
      version: 3,
      name: "scenario-changes",
      sql: `ALTER TABLE ds_scenarios ADD COLUMN IF NOT EXISTS changes_json TEXT NOT NULL DEFAULT '[]';`,
    },
    {
      version: 4,
      name: "monochrome-section-colors",
      sql: `
ALTER TABLE ds_sections ALTER COLUMN color SET DEFAULT '#ffffff';
UPDATE ds_sections SET color = '#ffffff' WHERE id = 'section-main' AND color = '#e8683f';
UPDATE ds_sections SET color = '#d4d4d4' WHERE id = 'section-patio' AND color = '#7fb069';
UPDATE ds_sections SET color = '#a3a3a3' WHERE id = 'section-bar' AND color = '#d9b36c';
UPDATE ds_sections SET color = '#737373' WHERE id = 'section-private' AND color = '#7c9cbf';
`,
    },
  ],
  { table: "double_shift_migrations" },
);
