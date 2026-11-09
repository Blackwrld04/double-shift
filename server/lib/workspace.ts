import { desc, eq } from "drizzle-orm";

import {
  getSetting,
  getUserSetting,
  putSetting,
  putUserSetting,
} from "@agent-native/core/settings";

import { getDb, schema } from "../db/index.js";
import {
  applyChangesToSim,
  type Change,
  type SimOverrides,
} from "./changes.js";
import { ensureSeed, VENUE_ID } from "./seed.js";
import {
  runMonteCarlo,
  type MonteCarloResult,
  type SimInput,
  type SimMenuItem,
  type SimStaff,
  type SimTable,
} from "./sim.js";

type JsonRecord = Record<string, unknown>;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type ActiveVenueContext = {
  venueId: string;
  onboarded: boolean;
  onboardingMode: "demo" | "custom" | null;
};

export async function getActiveVenueContext(userEmail?: string): Promise<ActiveVenueContext> {
  try {
    if (userEmail) {
      const userOnboarding = (await getUserSetting(userEmail, "venue-onboarding")) as {
        completed?: boolean;
        mode?: "demo" | "custom";
        venueId?: string;
      } | null;
      const userActive = (await getUserSetting(userEmail, "active-venue-id")) as {
        venueId?: string;
      } | null;

      if (userOnboarding?.completed) {
        return {
          venueId: userActive?.venueId || userOnboarding.venueId || VENUE_ID,
          onboarded: true,
          onboardingMode: userOnboarding.mode ?? "custom",
        };
      }

      return {
        venueId: VENUE_ID,
        onboarded: false,
        onboardingMode: null,
      };
    }

    const onboarding = (await getSetting("venue-onboarding")) as {
      completed?: boolean;
      mode?: "demo" | "custom";
      venueId?: string;
    } | null;
    const activeSetting = (await getSetting("active-venue-id")) as {
      venueId?: string;
    } | null;

    const isCompleted = Boolean(onboarding?.completed);
    const mode = onboarding?.mode ?? null;
    const venueId = activeSetting?.venueId || onboarding?.venueId || VENUE_ID;

    return {
      venueId,
      onboarded: isCompleted,
      onboardingMode: mode,
    };
  } catch {
    return {
      venueId: VENUE_ID,
      onboarded: !userEmail,
      onboardingMode: "demo",
    };
  }
}

export type WorkspaceData = {
  venue: typeof schema.venues.$inferSelect;
  floor: typeof schema.floors.$inferSelect;
  sections: Array<typeof schema.sections.$inferSelect>;
  tables: Array<typeof schema.diningTables.$inferSelect>;
  stations: Array<typeof schema.stations.$inferSelect>;
  staff: Array<typeof schema.staff.$inferSelect>;
  menu: Array<typeof schema.menuItems.$inferSelect>;
  demandProfiles: Array<typeof schema.demandProfiles.$inferSelect>;
  scenarios: Array<typeof schema.scenarios.$inferSelect>;
  proposals: Array<typeof schema.proposals.$inferSelect>;
  runs: Array<typeof schema.runs.$inferSelect>;
  activity: Array<typeof schema.activity.$inferSelect>;
  onboarded: boolean;
  onboardingMode: "demo" | "custom" | null;
  availableVenues: Array<{ id: string; name: string }>;
};

export async function loadWorkspace(
  explicitVenueId?: string,
  userEmail?: string,
): Promise<WorkspaceData> {
  await ensureSeed();
  const db = getDb();

  const allVenues = await db
    .select({ id: schema.venues.id, name: schema.venues.name })
    .from(schema.venues)
    .orderBy(desc(schema.venues.createdAt));

  const activeContext = await getActiveVenueContext(userEmail);
  let targetVenueId = explicitVenueId || activeContext.venueId;

  let [venue] = await db
    .select()
    .from(schema.venues)
    .where(eq(schema.venues.id, targetVenueId))
    .limit(1);

  if (!venue) {
    [venue] = await db
      .select()
      .from(schema.venues)
      .where(eq(schema.venues.id, VENUE_ID))
      .limit(1);
    if (venue) targetVenueId = venue.id;
  }
  if (!venue) throw new Error("Double Shift venue was not seeded.");

  let [floor] = await db
    .select()
    .from(schema.floors)
    .where(eq(schema.floors.venueId, targetVenueId))
    .limit(1);

  if (!floor) {
    [floor] = await db.select().from(schema.floors).limit(1);
  }
  if (!floor) throw new Error("Double Shift floor was not seeded.");

  const [sections, tables, stations, staff, menu, demandProfiles, scenarios, proposals, runs, activity] =
    await Promise.all([
      db.select().from(schema.sections).where(eq(schema.sections.floorId, floor.id)),
      db.select().from(schema.diningTables).where(eq(schema.diningTables.floorId, floor.id)),
      db.select().from(schema.stations).where(eq(schema.stations.floorId, floor.id)),
      db.select().from(schema.staff).where(eq(schema.staff.venueId, targetVenueId)),
      db.select().from(schema.menuItems).where(eq(schema.menuItems.venueId, targetVenueId)),
      db.select().from(schema.demandProfiles).where(eq(schema.demandProfiles.venueId, targetVenueId)),
      db.select().from(schema.scenarios).where(eq(schema.scenarios.venueId, targetVenueId)),
      db.select().from(schema.proposals).where(eq(schema.proposals.venueId, targetVenueId)),
      db
        .select()
        .from(schema.runs)
        .where(eq(schema.runs.venueId, targetVenueId))
        .orderBy(desc(schema.runs.createdAt))
        .limit(30),
      db
        .select()
        .from(schema.activity)
        .where(eq(schema.activity.venueId, targetVenueId))
        .orderBy(desc(schema.activity.createdAt))
        .limit(20),
    ]);

  return {
    venue,
    floor,
    sections,
    tables: tables.sort((a, b) => a.label.localeCompare(b.label)),
    stations,
    staff: staff.sort((a, b) => a.name.localeCompare(b.name)),
    menu: menu.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    demandProfiles,
    scenarios: scenarios.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    proposals: proposals.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    runs,
    activity,
    onboarded: activeContext.onboarded,
    onboardingMode: activeContext.onboardingMode,
    availableVenues: allVenues,
  };
}

export function buildSimInput(
  workspace: WorkspaceData,
  scenario: typeof schema.scenarios.$inferSelect,
  seed = 20261109,
): SimInput {
  const demand =
    workspace.demandProfiles.find((profile) => profile.id === scenario.demandProfileId) ??
    workspace.demandProfiles[0];
  if (!demand) throw new Error("No demand profile found for this scenario.");

  const changes = parseJson<Change[]>(scenario.changesJson, []);
  const baseTables = workspace.tables.map(
    (table): SimTable => ({
      id: table.id,
      label: table.label,
      sectionId: table.sectionId,
      seats: table.seats,
      x: table.x,
      y: table.y,
      width: table.width,
      height: table.height,
      shape: table.shape,
      active: table.active,
    }),
  );
  const baseStaff = workspace.staff.map(
    (member): SimStaff => ({
      id: member.id,
      name: member.name,
      role: member.role,
      station: member.station,
      sectionId: member.sectionId,
      shiftStart: member.shiftStart,
      shiftEnd: member.shiftEnd,
      hourlyRate: member.hourlyRate,
      maxTables: member.maxTables,
      maxSeats: member.maxSeats,
      active: member.active,
    }),
  );
  const baseMenu = workspace.menu.map(
    (item): SimMenuItem => ({
      id: item.id,
      name: item.name,
      category: item.category,
      station: item.station,
      prepMinutes: item.prepMinutes,
      cookMinutes: item.cookMinutes,
      price: item.price,
      margin: item.margin,
      active: item.active,
    }),
  );
  const overridden = applyChangesToSim<SimOverrides & { tables: SimTable[]; staff: SimStaff[]; menu: SimMenuItem[] }>(
    { tables: baseTables, staff: baseStaff, menu: baseMenu },
    changes,
  );

  return {
    tables: overridden.tables,
    sections: workspace.sections.map((section) => ({ id: section.id, name: section.name })),
    // Keep menu names/categories/prices from the workspace after overrides.
    staff: overridden.staff,
    menu: overridden.menu,
    demand: {
      startTime: demand.startTime,
      endTime: demand.endTime,
      covers: demand.covers,
      curve: parseJson(demand.curveJson, []),
      partyMix: parseJson(demand.partyMixJson, { "2": 1 }),
      noShowRate: demand.noShowRate,
      walkoutThresholdMin: demand.walkoutThresholdMin,
    },
    demandMultiplier: scenario.demandMultiplier,
    patioClosed: scenario.patioClosed,
    callouts: parseJson(scenario.calloutsJson, []),
    seed,
  };
}

export function runScenarioToResult(
  workspace: WorkspaceData,
  scenario: typeof schema.scenarios.$inferSelect,
  replications: number,
  seed = 20261109,
): MonteCarloResult {
  return runMonteCarlo(buildSimInput(workspace, scenario, seed), replications);
}

export async function storeRun(
  scenario: typeof schema.scenarios.$inferSelect,
  result: MonteCarloResult,
  workspace: WorkspaceData,
): Promise<typeof schema.runs.$inferSelect> {
  const db = getDb();
  const id = `run-${scenario.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const snapshot = {
    tables: workspace.tables,
    staff: workspace.staff,
    menu: workspace.menu,
    demand: workspace.demandProfiles.find((profile) => profile.id === scenario.demandProfileId),
    scenario: {
      id: scenario.id,
      name: scenario.name,
      demandMultiplier: scenario.demandMultiplier,
      patioClosed: scenario.patioClosed,
      callouts: parseJson(scenario.calloutsJson, []),
      changes: parseJson(scenario.changesJson, []),
    },
  };
  const [row] = await db
    .insert(schema.runs)
    .values({
      id,
      scenarioId: scenario.id,
      venueId: scenario.venueId,
      seed: result.representativeSeed,
      replications: result.metrics.replications,
      status: "complete",
      metricsJson: JSON.stringify(result.metrics),
      timelineJson: JSON.stringify(result.timeline),
      eventsJson: JSON.stringify(result.events),
      snapshotJson: JSON.stringify(snapshot),
      createdAt: new Date().toISOString(),
    })
    .returning();
  const stored = row;
  if (!stored) throw new Error("Failed to store the simulation run.");
  await db.insert(schema.activity).values({
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    venueId: scenario.venueId,
    kind: "run",
    message: `Simulated ${result.metrics.replications} services for “${scenario.name}”.`,
    actor: "Double Shift",
    metadataJson: JSON.stringify({
      scenarioId: scenario.id,
      runId: id,
      p95Wait: result.metrics.p95Wait,
      net: result.metrics.net,
    }),
    createdAt: new Date().toISOString(),
  });
  return stored;
}

export function runSummary(row: typeof schema.runs.$inferSelect): {
  id: string;
  scenarioId: string;
  createdAt: string;
  replications: number;
  metrics: MonteCarloResult["metrics"];
} {
  const metrics = parseJson<MonteCarloResult["metrics"]>(
    row.metricsJson,
    {} as MonteCarloResult["metrics"],
  );
  return {
    id: row.id,
    scenarioId: row.scenarioId,
    createdAt: row.createdAt,
    replications: row.replications,
    metrics,
  };
}

export { parseJson };
