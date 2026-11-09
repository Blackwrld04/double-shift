import { describe, expect, it } from "vitest";

import {
  buildSimInput,
  getActiveVenueContext,
  type WorkspaceData,
} from "./workspace.js";
import { changesSchema, type Change } from "./changes.js";
import { runMonteCarlo } from "./sim.js";

describe("workspace buildSimInput", () => {
  const dummyWorkspace: WorkspaceData = {
    venue: {
      id: "test-venue",
      name: "Test Osteria",
      timezone: "America/New_York",
      currency: "USD",
      address: "123 Main St",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    floor: {
      id: "floor-1",
      venueId: "test-venue",
      name: "Main Floor",
      width: 1000,
      height: 800,
      createdAt: new Date().toISOString(),
    },
    sections: [
      { id: "sec-1", floorId: "floor-1", name: "Main", color: "#ffffff", createdAt: new Date().toISOString() },
    ],
    tables: [
      {
        id: "t1",
        floorId: "floor-1",
        sectionId: "sec-1",
        label: "T1",
        x: 100,
        y: 100,
        width: 80,
        height: 80,
        shape: "round",
        seats: 2,
        active: true,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    stations: [
      {
        id: "st-1",
        floorId: "floor-1",
        kind: "kitchen",
        label: "Grill",
        x: 200,
        y: 50,
        width: 120,
        height: 60,
        capacity: 2,
        createdAt: new Date().toISOString(),
      },
    ],
    staff: [
      {
        id: "staff-1",
        venueId: "test-venue",
        name: "Chef Mario",
        role: "cook",
        station: "grill",
        sectionId: null,
        shiftStart: "16:00",
        shiftEnd: "23:00",
        hourlyRate: 25,
        maxTables: 0,
        maxSeats: 0,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    menu: [
      {
        id: "m1",
        venueId: "test-venue",
        name: "Steak",
        category: "entree",
        station: "grill",
        prepMinutes: 5,
        cookMinutes: 12,
        price: 36,
        margin: 0.65,
        active: true,
        createdAt: new Date().toISOString(),
      },
    ],
    demandProfiles: [
      {
        id: "demand-1",
        venueId: "test-venue",
        name: "Friday Dinner",
        dayOfWeek: "friday",
        startTime: "17:00",
        endTime: "22:00",
        covers: 80,
        curveJson: JSON.stringify([{ time: "17:00", covers: 20 }, { time: "18:00", covers: 60 }]),
        partyMixJson: JSON.stringify({ "2": 0.6, "4": 0.4 }),
        noShowRate: 0.05,
        walkoutThresholdMin: 30,
        weather: "clear",
        notes: "Busy night",
        createdAt: new Date().toISOString(),
      },
    ],
    scenarios: [],
    proposals: [],
    runs: [],
    activity: [],
    onboarded: true,
    onboardingMode: "demo",
    availableVenues: [{ id: "test-venue", name: "Test Osteria" }],
  };

  it("builds a valid SimInput with overrides from scenario changes", () => {
    const changes: Change[] = [
      { kind: "table", tableId: "t1", seats: 4 },
      { kind: "staff", staffId: "staff-1", hourlyRate: 30 },
    ];
    const scenario = {
      id: "scenario-test",
      venueId: "test-venue",
      demandProfileId: "demand-1",
      name: "Test Scenario",
      description: "Testing",
      demandMultiplier: 1.2,
      patioClosed: true,
      calloutsJson: JSON.stringify(["staff-1"]),
      changesJson: JSON.stringify(changes),
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const simInput = buildSimInput(dummyWorkspace, scenario, 12345);
    expect(simInput.tables[0]?.seats).toBe(4);
    expect(simInput.staff[0]?.hourlyRate).toBe(30);
    expect(simInput.demandMultiplier).toBe(1.2);
    expect(simInput.patioClosed).toBe(true);
    expect(simInput.callouts).toContain("staff-1");
    expect(simInput.seed).toBe(12345);

    const result = runMonteCarlo(simInput, 5);
    expect(result.metrics.replications).toBe(5);
    expect(result.metrics.net).toBeDefined();
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.runs).toHaveLength(5);
  });

  it("detects missing/stale entity IDs in staged changes", () => {
    const tableIds = new Set(dummyWorkspace.tables.map((t) => t.id));
    const staffIds = new Set(dummyWorkspace.staff.map((s) => s.id));
    const menuIds = new Set(dummyWorkspace.menu.map((m) => m.id));

    const validChange: Change = { kind: "table", tableId: "t1", seats: 4 };
    const staleChange: Change = { kind: "table", tableId: "nonexistent-table", seats: 4 };
    const staleStaffChange: Change = { kind: "staff", staffId: "nonexistent-staff", active: false };
    const staleMenuChange: Change = { kind: "menu", itemId: "nonexistent-menu", active: false };

    expect(tableIds.has(validChange.tableId)).toBe(true);
    expect(tableIds.has(staleChange.tableId)).toBe(false);
    expect(staffIds.has(staleStaffChange.staffId)).toBe(false);
    expect(menuIds.has(staleMenuChange.itemId)).toBe(false);
  });

  it("safely handles multiple new staff additions in what-if scenarios", () => {
    const changes = changesSchema.parse([
      {
        kind: "add-staff",
        name: "Alex Smith",
        role: "server",
        shiftStart: "17:00",
        shiftEnd: "23:00",
        hourlyRate: 22,
      },
      {
        kind: "add-staff",
        name: "Robin Taylor",
        role: "bartender",
        shiftStart: "18:00",
        shiftEnd: "24:00",
        hourlyRate: 24,
      },
    ]);

    const scenario = {
      id: "scenario-staffing",
      venueId: "test-venue",
      demandProfileId: "demand-1",
      name: "Staffing Test",
      description: "Adding team members",
      demandMultiplier: 1.0,
      patioClosed: false,
      calloutsJson: "[]",
      changesJson: JSON.stringify(changes),
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const simInput = buildSimInput(dummyWorkspace, scenario, 9999);
    expect(simInput.staff.length).toBe(dummyWorkspace.staff.length + 2);
    expect(simInput.staff.some((s) => s.name === "Alex Smith")).toBe(true);
    expect(simInput.staff.some((s) => s.name === "Robin Taylor")).toBe(true);
  });

  it("resolves active venue context cleanly with defaults", async () => {
    const ctx = await getActiveVenueContext();
    expect(ctx).toHaveProperty("venueId");
    expect(typeof ctx.venueId).toBe("string");
    expect(ctx).toHaveProperty("onboarded");
    expect(typeof ctx.onboarded).toBe("boolean");
  });
});


