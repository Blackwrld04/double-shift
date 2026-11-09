import { defineAction } from "@agent-native/core/action";
import { putSetting, putUserSetting } from "@agent-native/core/settings";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { ensureSeed, VENUE_ID } from "../server/lib/seed.js";
import {
  buildSimInput,
  loadWorkspace,
  runScenarioToResult,
  storeRun,
} from "../server/lib/workspace.js";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "venue"
  );
}

export default defineAction({
  description:
    "Set up the restaurant venue for Double Shift. Either configure a custom restaurant or load the sample demo (Osteria Nove).",
  schema: z.object({
    mode: z
      .enum(["custom", "demo"])
      .default("custom")
      .describe("Setup mode: 'custom' to create a new restaurant, or 'demo' to explore Osteria Nove"),
    name: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe("Restaurant name for custom setup"),
    address: z
      .string()
      .max(200)
      .optional()
      .describe("Restaurant address or city"),
    timezone: z
      .string()
      .default("America/New_York")
      .describe("Restaurant timezone"),
    currency: z.string().default("USD").describe("Currency symbol/code"),
    shiftName: z
      .string()
      .default("Dinner Service")
      .describe("Name of primary service shift"),
    shiftStart: z.string().default("17:00").describe("Shift start time (HH:MM)"),
    shiftEnd: z.string().default("22:30").describe("Shift end time (HH:MM)"),
    targetCovers: z
      .coerce.number()
      .int()
      .min(10)
      .max(500)
      .default(80)
      .describe("Target covers/guests for the shift"),
    template: z
      .enum(["bistro", "blank"])
      .default("bistro")
      .describe("Starter floor template"),
  }),
  run: async (input, ctx) => {
    const db = getDb();
    const nowIso = new Date().toISOString();
    const userEmail = ctx?.userEmail;

    if (input.mode === "demo") {
      await ensureSeed();
      if (userEmail) {
        await putUserSetting(userEmail, "venue-onboarding", {
          completed: true,
          mode: "demo",
          venueId: VENUE_ID,
          updatedAt: nowIso,
        });
        await putUserSetting(userEmail, "active-venue-id", {
          venueId: VENUE_ID,
          updatedAt: nowIso,
        });
      }
      await putSetting("venue-onboarding", {
        completed: true,
        mode: "demo",
        venueId: VENUE_ID,
        updatedAt: nowIso,
      });
      await putSetting("active-venue-id", {
        venueId: VENUE_ID,
        updatedAt: nowIso,
      });
      return { ok: true, mode: "demo", venueId: VENUE_ID };
    }

    // Custom Restaurant Setup
    const venueName = input.name?.trim() || "My Restaurant";
    const venueSlug = slugify(venueName);
    const venueId = `venue-${venueSlug}-${Math.random().toString(36).slice(2, 7)}`;
    const floorId = `floor-${venueId}-main`;
    const sectionMain = `sec-${venueId}-main`;
    const sectionBar = `sec-${venueId}-bar`;
    const scenarioId = `scenario-${venueId}-baseline`;
    const demandId = `demand-${venueId}-primary`;

    // 1. Create Venue
    await db.insert(schema.venues).values({
      id: venueId,
      name: venueName,
      address: input.address?.trim() || "100 Main Street",
      timezone: input.timezone || "America/New_York",
      currency: input.currency || "USD",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // 2. Create Floor
    await db.insert(schema.floors).values({
      id: floorId,
      venueId,
      name: "Main Dining Room",
      width: 1200,
      height: 760,
      createdAt: nowIso,
    });

    // 3. Create Sections
    await db.insert(schema.sections).values([
      {
        id: sectionMain,
        floorId,
        name: "Main Room",
        color: "#ffffff",
        createdAt: nowIso,
      },
      {
        id: sectionBar,
        floorId,
        name: "Bar Area",
        color: "#a3a3a3",
        createdAt: nowIso,
      },
    ]);

    // 4. Create Stations
    await db.insert(schema.stations).values([
      {
        id: `station-${venueId}-pass`,
        floorId,
        kind: "pass",
        label: "Pass",
        x: 60,
        y: 350,
        width: 130,
        height: 54,
        capacity: 2,
        createdAt: nowIso,
      },
      {
        id: `station-${venueId}-grill`,
        floorId,
        kind: "grill",
        label: "Grill",
        x: 60,
        y: 200,
        width: 110,
        height: 50,
        capacity: 1,
        createdAt: nowIso,
      },
      {
        id: `station-${venueId}-saute`,
        floorId,
        kind: "saute",
        label: "Sauté",
        x: 60,
        y: 275,
        width: 110,
        height: 50,
        capacity: 1,
        createdAt: nowIso,
      },
      {
        id: `station-${venueId}-bar`,
        floorId,
        kind: "bar",
        label: "Bar",
        x: 880,
        y: 380,
        width: 110,
        height: 50,
        capacity: 1,
        createdAt: nowIso,
      },
    ]);

    // 5. Tables & Layout
    if (input.template === "bistro") {
      await db.insert(schema.diningTables).values([
        { id: `t-${venueId}-01`, floorId, sectionId: sectionMain, label: "T01", x: 220, y: 180, width: 76, height: 76, shape: "round", seats: 2, active: true, createdAt: nowIso, updatedAt: nowIso },
        { id: `t-${venueId}-02`, floorId, sectionId: sectionMain, label: "T02", x: 360, y: 180, width: 76, height: 76, shape: "round", seats: 2, active: true, createdAt: nowIso, updatedAt: nowIso },
        { id: `t-${venueId}-03`, floorId, sectionId: sectionMain, label: "T03", x: 500, y: 180, width: 76, height: 76, shape: "round", seats: 2, active: true, createdAt: nowIso, updatedAt: nowIso },
        { id: `t-${venueId}-04`, floorId, sectionId: sectionMain, label: "T04", x: 220, y: 340, width: 96, height: 96, shape: "rect", seats: 4, active: true, createdAt: nowIso, updatedAt: nowIso },
        { id: `t-${venueId}-05`, floorId, sectionId: sectionMain, label: "T05", x: 360, y: 340, width: 96, height: 96, shape: "rect", seats: 4, active: true, createdAt: nowIso, updatedAt: nowIso },
        { id: `t-${venueId}-06`, floorId, sectionId: sectionMain, label: "T06", x: 500, y: 340, width: 96, height: 96, shape: "rect", seats: 4, active: true, createdAt: nowIso, updatedAt: nowIso },
        { id: `t-${venueId}-07`, floorId, sectionId: sectionMain, label: "T07", x: 290, y: 500, width: 128, height: 92, shape: "rect", seats: 6, active: true, createdAt: nowIso, updatedAt: nowIso },
        { id: `b-${venueId}-01`, floorId, sectionId: sectionBar, label: "B01", x: 880, y: 200, width: 76, height: 76, shape: "round", seats: 2, active: true, createdAt: nowIso, updatedAt: nowIso },
      ]);
    } else {
      // Blank slate starter tables
      await db.insert(schema.diningTables).values([
        { id: `t-${venueId}-01`, floorId, sectionId: sectionMain, label: "T01", x: 300, y: 260, width: 76, height: 76, shape: "round", seats: 2, active: true, createdAt: nowIso, updatedAt: nowIso },
        { id: `t-${venueId}-02`, floorId, sectionId: sectionMain, label: "T02", x: 440, y: 260, width: 96, height: 96, shape: "rect", seats: 4, active: true, createdAt: nowIso, updatedAt: nowIso },
      ]);
    }

    // 6. Staff
    await db.insert(schema.staff).values([
      { id: `staff-${venueId}-host`, venueId, name: "Host Team", role: "host", shiftStart: "16:30", shiftEnd: "23:00", hourlyRate: 22, maxTables: 0, maxSeats: 0, active: true, createdAt: nowIso, updatedAt: nowIso },
      { id: `staff-${venueId}-srv1`, venueId, name: "Lead Server", role: "server", sectionId: sectionMain, shiftStart: "16:30", shiftEnd: "23:00", hourlyRate: 24, maxTables: 4, maxSeats: 18, active: true, createdAt: nowIso, updatedAt: nowIso },
      { id: `staff-${venueId}-srv2`, venueId, name: "Floor Server", role: "server", sectionId: sectionMain, shiftStart: "17:00", shiftEnd: "23:00", hourlyRate: 24, maxTables: 4, maxSeats: 18, active: true, createdAt: nowIso, updatedAt: nowIso },
      { id: `staff-${venueId}-cook`, venueId, name: "Line Cook", role: "cook", station: "grill", shiftStart: "16:00", shiftEnd: "23:00", hourlyRate: 26, maxTables: 0, maxSeats: 0, active: true, createdAt: nowIso, updatedAt: nowIso },
      { id: `staff-${venueId}-chef`, venueId, name: "Head Chef", role: "chef", station: "pass", shiftStart: "16:00", shiftEnd: "23:00", hourlyRate: 34, maxTables: 0, maxSeats: 0, active: true, createdAt: nowIso, updatedAt: nowIso },
    ]);

    // 7. Menu
    await db.insert(schema.menuItems).values([
      { id: `menu-${venueId}-salad`, venueId, name: "House Salad", category: "starter", station: "cold", prepMinutes: 4, cookMinutes: 0, price: 14, margin: 0.76, active: true, createdAt: nowIso },
      { id: `menu-${venueId}-pasta`, venueId, name: "Fresh Pasta", category: "main", station: "saute", prepMinutes: 4, cookMinutes: 8, price: 24, margin: 0.72, active: true, createdAt: nowIso },
      { id: `menu-${venueId}-entree`, venueId, name: "Grilled Entree", category: "main", station: "grill", prepMinutes: 4, cookMinutes: 12, price: 34, margin: 0.65, active: true, createdAt: nowIso },
      { id: `menu-${venueId}-dessert`, venueId, name: "House Dessert", category: "dessert", station: "cold", prepMinutes: 2, cookMinutes: 0, price: 12, margin: 0.8, active: true, createdAt: nowIso },
      { id: `menu-${venueId}-drink`, venueId, name: "House Beverage", category: "cocktail", station: "bar", prepMinutes: 2, cookMinutes: 0, price: 14, margin: 0.82, active: true, createdAt: nowIso },
    ]);

    // 8. Demand Profile
    const covers = input.targetCovers || 80;
    const curve = [
      { time: "17:00", covers: Math.max(1, Math.round(covers * 0.04)) },
      { time: "17:30", covers: Math.max(2, Math.round(covers * 0.08)) },
      { time: "18:00", covers: Math.max(3, Math.round(covers * 0.14)) },
      { time: "18:30", covers: Math.max(4, Math.round(covers * 0.18)) },
      { time: "19:00", covers: Math.max(4, Math.round(covers * 0.20)) },
      { time: "19:30", covers: Math.max(3, Math.round(covers * 0.16)) },
      { time: "20:00", covers: Math.max(2, Math.round(covers * 0.10)) },
      { time: "20:30", covers: Math.max(1, Math.round(covers * 0.06)) },
      { time: "21:00", covers: Math.max(1, Math.round(covers * 0.04)) },
    ];

    await db.insert(schema.demandProfiles).values({
      id: demandId,
      venueId,
      name: input.shiftName || "Dinner Service",
      dayOfWeek: "friday",
      startTime: input.shiftStart || "17:00",
      endTime: input.shiftEnd || "22:30",
      covers,
      curveJson: JSON.stringify(curve),
      partyMixJson: JSON.stringify({
        "1": 0.05,
        "2": 0.5,
        "4": 0.35,
        "6": 0.1,
      }),
      noShowRate: 0.05,
      walkoutThresholdMin: 28,
      weather: "clear",
      createdAt: nowIso,
    });

    // 9. Baseline Scenario
    await db.insert(schema.scenarios).values({
      id: scenarioId,
      venueId,
      demandProfileId: demandId,
      name: `${input.shiftName || "Dinner"} Baseline`,
      description: "Baseline service control plan",
      demandMultiplier: 1.0,
      patioClosed: false,
      calloutsJson: "[]",
      changesJson: "[]",
      status: "baseline",
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // 10. Update Onboarding & Active Settings
    if (userEmail) {
      await putUserSetting(userEmail, "venue-onboarding", {
        completed: true,
        mode: "custom",
        venueId,
        updatedAt: nowIso,
      });
      await putUserSetting(userEmail, "active-venue-id", {
        venueId,
        updatedAt: nowIso,
      });
    }
    await putSetting("venue-onboarding", {
      completed: true,
      mode: "custom",
      venueId,
      updatedAt: nowIso,
    });
    await putSetting("active-venue-id", {
      venueId,
      updatedAt: nowIso,
    });

    // 11. Run Initial Simulation for Twin Warm-Up
    const freshWorkspace = await loadWorkspace(venueId);
    const baselineScenario = freshWorkspace.scenarios.find(
      (s) => s.id === scenarioId,
    );
    if (baselineScenario) {
      const result = runScenarioToResult(freshWorkspace, baselineScenario, 25);
      await storeRun(baselineScenario, result, freshWorkspace);
    }

    return {
      ok: true,
      mode: "custom",
      venueId,
      venueName,
    };
  },
});

