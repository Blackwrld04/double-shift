import { describe, expect, it } from "vitest";

import { applyChangesToSim, changesSchema, describeChange, type Change } from "./changes.js";
import { clockLabel, parseClock, runMonteCarlo, runSimulation, type SimInput } from "./sim.js";

function fixture(overrides: Partial<SimInput> = {}): SimInput {
  const tables = Array.from({ length: 10 }, (_, index) => ({
    id: `t${index + 1}`,
    label: `T${index + 1}`,
    sectionId: index < 6 ? "section-main" : "section-patio",
    seats: index % 3 === 0 ? 2 : 4,
    x: 100 + index * 90,
    y: 200,
    width: 80,
    height: 80,
    shape: "rect",
    active: true,
  }));
  return {
    tables,
    sections: [
      { id: "section-main", name: "Main Room" },
      { id: "section-patio", name: "Patio" },
    ],
    staff: [
      {
        id: "staff-ana",
        name: "Ana",
        role: "server",
        station: null,
        sectionId: "section-main",
        shiftStart: "17:00",
        shiftEnd: "23:00",
        hourlyRate: 20,
        maxTables: 6,
        maxSeats: 24,
        active: true,
      },
      {
        id: "staff-ben",
        name: "Ben",
        role: "server",
        station: null,
        sectionId: "section-patio",
        shiftStart: "17:00",
        shiftEnd: "23:00",
        hourlyRate: 20,
        maxTables: 4,
        maxSeats: 16,
        active: true,
      },
      {
        id: "staff-cy",
        name: "Cy",
        role: "cook",
        station: "grill",
        sectionId: null,
        shiftStart: "16:00",
        shiftEnd: "23:00",
        hourlyRate: 26,
        maxTables: 0,
        maxSeats: 0,
        active: true,
      },
    ],
    menu: [
      {
        id: "m1",
        name: "Pasta",
        category: "main",
        station: "saute",
        prepMinutes: 4,
        cookMinutes: 8,
        price: 24,
        margin: 0.7,
        active: true,
      },
      {
        id: "m2",
        name: "Steak",
        category: "main",
        station: "grill",
        prepMinutes: 5,
        cookMinutes: 14,
        price: 42,
        margin: 0.6,
        active: true,
      },
    ],
    demand: {
      startTime: "17:00",
      endTime: "22:30",
      covers: 60,
      curve: [
        { time: "17:00", covers: 6 },
        { time: "18:00", covers: 14 },
        { time: "19:00", covers: 16 },
        { time: "20:00", covers: 12 },
        { time: "21:00", covers: 6 },
      ],
      partyMix: { "2": 0.5, "4": 0.4, "6": 0.1 },
      noShowRate: 0.05,
      walkoutThresholdMin: 28,
    },
    demandMultiplier: 1,
    patioClosed: false,
    callouts: [],
    seed: 42,
    ...overrides,
  };
}

describe("clock helpers", () => {
  it("parses HH:MM and falls back to opening time on garbage", () => {
    expect(parseClock("17:30")).toBe(17 * 60 + 30);
    expect(parseClock("9:05")).toBe(9 * 60 + 5);
    expect(parseClock("nonsense")).toBe(17 * 60);
  });

  it("labels minutes as 12-hour clock times", () => {
    expect(clockLabel(17 * 60)).toBe("5:00 PM");
    expect(clockLabel(0)).toBe("12:00 AM");
    expect(clockLabel(12 * 60 + 5)).toBe("12:05 PM");
  });
});

describe("runSimulation", () => {
  it("is deterministic for the same seed", () => {
    const a = runSimulation(fixture());
    const b = runSimulation(fixture());
    expect(b.metrics).toEqual(a.metrics);
    expect(b.timeline).toEqual(a.timeline);
  });

  it("changes with the seed", () => {
    const a = runSimulation(fixture({ seed: 1 }));
    const b = runSimulation(fixture({ seed: 2 }));
    expect(JSON.stringify(a.metrics)).not.toEqual(JSON.stringify(b.metrics));
  });

  it("does not mutate its input", () => {
    const input = fixture();
    const snapshot = JSON.stringify(input);
    runSimulation(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("produces internally consistent metrics", () => {
    const { metrics } = runSimulation(fixture());
    expect(metrics.coversSeated).toBeGreaterThan(0);
    expect(metrics.coversSeated + metrics.coversWalked).toBeLessThanOrEqual(metrics.coversRequested);
    expect(metrics.p95Wait).toBeGreaterThanOrEqual(metrics.avgWait);
    expect(metrics.maxWait).toBeGreaterThanOrEqual(metrics.p95Wait);
    expect(metrics.utilization).toBeGreaterThanOrEqual(0);
    expect(metrics.utilization).toBeLessThanOrEqual(1);
    expect(metrics.net).toBeCloseTo(metrics.contribution - metrics.laborCost, 0);
  });

  it("requests more covers when demand goes up", () => {
    const base = runSimulation(fixture());
    const busy = runSimulation(fixture({ demandMultiplier: 2 }));
    expect(busy.metrics.coversRequested).toBeGreaterThan(base.metrics.coversRequested);
  });

  it("walks out more guests when every server calls out", () => {
    const base = runSimulation(fixture());
    const none = runSimulation(fixture({ callouts: ["staff-ana", "staff-ben"] }));
    expect(none.metrics.coversSeated).toBeLessThan(base.metrics.coversSeated);
    expect(none.metrics.walkouts).toBeGreaterThanOrEqual(base.metrics.walkouts);
  });

  it("costs less labor when a server is out", () => {
    const base = runSimulation(fixture());
    const short = runSimulation(fixture({ callouts: ["staff-ben"] }));
    expect(short.metrics.laborCost).toBeLessThan(base.metrics.laborCost);
  });
});

describe("runMonteCarlo", () => {
  it("is deterministic and reports a range per headline metric", () => {
    const a = runMonteCarlo(fixture(), 5);
    const b = runMonteCarlo(fixture(), 5);
    expect(b.metrics).toEqual(a.metrics);
    expect(a.runs).toHaveLength(5);
    expect(a.metrics.replications).toBe(5);
    expect(a.metrics.range.net[0]).toBeLessThanOrEqual(a.metrics.range.net[1]);
  });

  it("clamps replication counts into 1..200", () => {
    expect(runMonteCarlo(fixture(), 0).runs).toHaveLength(1);
    expect(runMonteCarlo(fixture(), -4).runs).toHaveLength(1);
    expect(runMonteCarlo(fixture(), 500).metrics.replications).toBe(200);
  });
});

describe("applyChangesToSim", () => {
  const base = fixture();

  it("applies table, staff, add-staff and menu changes without mutating the base", () => {
    const snapshot = JSON.stringify(base);
    const changes: Change[] = [
      { kind: "table", tableId: "t1", active: false, seats: 6 },
      { kind: "staff", staffId: "staff-ana", maxTables: 3 },
      {
        kind: "add-staff",
        name: "Dee Lee",
        role: "server",
        shiftStart: "17:00",
        shiftEnd: "23:00",
        hourlyRate: 24,
        maxTables: 4,
        maxSeats: 18,
      },
      { kind: "menu", itemId: "m2", active: false },
    ];
    const next = applyChangesToSim(base, changes);

    expect(JSON.stringify(base)).toBe(snapshot);
    expect(next.tables.find((table) => table.id === "t1")).toMatchObject({ active: false, seats: 6 });
    expect(next.staff.find((member) => member.id === "staff-ana")?.maxTables).toBe(3);
    expect(next.staff.find((member) => member.id === "staff-dee-lee")?.active).toBe(true);
    expect(next.menu.find((item) => item.id === "m2")?.active).toBe(false);
  });

  it("skips unknown ids instead of throwing", () => {
    const next = applyChangesToSim(base, [
      { kind: "table", tableId: "nope", active: false },
      { kind: "staff", staffId: "nope", active: false },
      { kind: "menu", itemId: "nope", active: false },
    ]);
    expect(next.tables).toEqual(base.tables);
    expect(next.staff).toEqual(base.staff);
    expect(next.menu).toEqual(base.menu);
  });

  it("does not add the same new hire twice", () => {
    const hire: Change = {
      kind: "add-staff",
      name: "Dee Lee",
      role: "server",
      shiftStart: "17:00",
      shiftEnd: "23:00",
      hourlyRate: 24,
      maxTables: 4,
      maxSeats: 18,
    };
    const next = applyChangesToSim(base, [hire, hire]);
    expect(next.staff.filter((member) => member.id === "staff-dee-lee")).toHaveLength(1);
  });
});

describe("changesSchema", () => {
  it("accepts a valid change list and fills add-staff defaults", () => {
    const parsed = changesSchema.parse([{ kind: "add-staff", name: "Sam" }]);
    expect(parsed[0]).toMatchObject({ kind: "add-staff", role: "server", shiftStart: "17:00", hourlyRate: 24 });
  });

  it("rejects empty lists, unknown kinds and out-of-range values", () => {
    expect(changesSchema.safeParse([]).success).toBe(false);
    expect(changesSchema.safeParse([{ kind: "teleport" }]).success).toBe(false);
    expect(changesSchema.safeParse([{ kind: "table", tableId: "t1", seats: 99 }]).success).toBe(false);
  });

  it("describes every change kind in plain language", () => {
    const changes = changesSchema.parse([
      { kind: "table", tableId: "t1", active: false },
      { kind: "staff", staffId: "staff-ana", active: false },
      { kind: "add-staff", name: "Sam" },
      { kind: "menu", itemId: "m1", active: false },
    ]);
    for (const change of changes) expect(describeChange(change).length).toBeGreaterThan(0);
  });
});

