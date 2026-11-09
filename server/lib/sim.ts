/**
 * Double Shift service simulator.
 *
 * Deterministic, seeded, pure TypeScript. The LLM never calculates any of
 * these numbers; it calls `run-scenario` and reads the result.
 *
 * The model is intentionally transparent: arrivals from a 15-minute demand
 * curve, host seating by party size and server capacity, station queues for
 * the kitchen, and table turns from order to bus. It is a planning estimate,
 * not a POS forecast.
 */

export type SimSection = {
  id: string;
  name: string;
};

export type SimTable = {
  id: string;
  label: string;
  sectionId: string | null;
  seats: number;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: string;
  active: boolean;
};

export type SimStaff = {
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

export type SimMenuItem = {
  id: string;
  name: string;
  category: string;
  station: string;
  prepMinutes: number;
  cookMinutes: number;
  price: number;
  margin: number;
  active: boolean;
};

export type SimDemand = {
  startTime: string;
  endTime: string;
  covers: number;
  curve: Array<{ time: string; covers: number }>;
  partyMix: Record<string, number>;
  noShowRate: number;
  walkoutThresholdMin: number;
};

export type SimInput = {
  tables: SimTable[];
  sections: SimSection[];
  staff: SimStaff[];
  menu: SimMenuItem[];
  demand: SimDemand;
  demandMultiplier: number;
  patioClosed: boolean;
  callouts: string[];
  seed: number;
};

export type SimEvent = {
  t: number;
  label: string;
  type:
    | "arrival"
    | "seated"
    | "wait"
    | "walkout"
    | "ticket"
    | "bottleneck"
    | "turn"
    | "labor"
    | "summary";
  severity: "info" | "warn" | "danger";
  detail: string;
  tableId?: string;
  station?: string;
};

export type TimelinePoint = {
  t: number;
  label: string;
  arrivals: number;
  seated: number;
  waiting: number;
  occupied: number;
  kitchenQueue: number;
  avgWait: number;
  walkouts: number;
  covers: number;
};

export type SimMetrics = {
  coversRequested: number;
  coversSeated: number;
  coversWalked: number;
  noShows: number;
  parties: number;
  partiesSeated: number;
  walkouts: number;
  avgWait: number;
  p95Wait: number;
  maxWait: number;
  tableTurns: number;
  utilization: number;
  revenue: number;
  contribution: number;
  laborCost: number;
  net: number;
  kitchenP95: number;
  kitchenMax: number;
  bottleneck: string;
  bottleneckAt: string;
  overtimeMinutes: number;
  avgTicket: number;
  coversPerServerHour: number;
  sectionWaits: Array<{
    sectionId: string;
    sectionName: string;
    avgWait: number;
    p95Wait: number;
    seated: number;
  }>;
  stationLoad: Array<{
    station: string;
    maxQueue: number;
    at: string;
    totalDelay: number;
  }>;
  tableStats: Array<{
    tableId: string;
    label: string;
    sectionId: string | null;
    sectionName: string;
    seats: number;
    parties: number;
    covers: number;
    avgWait: number;
    p95Wait: number;
    occupiedMinutes: number;
    utilization: number;
  }>;
};

export type SimResult = {
  seed: number;
  metrics: SimMetrics;
  timeline: TimelinePoint[];
  events: SimEvent[];
  seedLabel: string;
};

export type MonteCarloResult = {
  metrics: SimMetrics & {
    replications: number;
    range: {
      p95Wait: [number, number];
      net: [number, number];
      walkouts: [number, number];
    };
  };
  timeline: TimelinePoint[];
  events: SimEvent[];
  representativeSeed: number;
  runs: Array<{ seed: number; net: number; p95Wait: number; walkouts: number }>;
};

const OPEN_MINUTE = 17 * 60;
const CLOSE_MINUTE = 22 * 60 + 30;
const END_MINUTE = 24 * 60;
const SERVICE_MINUTES = CLOSE_MINUTE - OPEN_MINUTE;
const STATIONS = ["grill", "saute", "fry", "cold", "bar"] as const;

export function parseClock(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return OPEN_MINUTE;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function clockLabel(minute: number): string {
  const normalized = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, rng: () => number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    // Normal approximation is plenty for a planning simulation.
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
  }
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= rng();
  } while (product > limit);
  return count - 1;
}

function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: () => number): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (total <= 0 || items.length === 0) return items[0]!;
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1]!;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

type TableState = {
  id: string;
  label: string;
  sectionId: string | null;
  seats: number;
  status: "free" | "seated";
  partyId?: string;
  serverId?: string;
  seatedAt?: number;
  orderAt?: number;
  foodAt?: number;
  finishAt?: number;
  busAt?: number;
};

type Party = {
  id: string;
  size: number;
  arrival: number;
  waitStarted: number;
  status: "waiting" | "seated" | "walked" | "done";
  tableId?: string;
  sectionId?: string | null;
  seatedAt?: number;
  wait?: number;
};

type ServerState = {
  id: string;
  name: string;
  sectionId: string | null;
  tables: Set<string>;
  seats: number;
  maxTables: number;
  maxSeats: number;
  shiftStart: number;
  shiftEnd: number;
  hourlyRate: number;
};

function partySizeFromMix(mix: Record<string, number>, rng: () => number): number {
  const entries = Object.entries(mix)
    .map(([size, weight]) => ({ size: Number(size), weight }))
    .filter((entry) => Number.isFinite(entry.size) && entry.size > 0 && entry.weight > 0);
  if (entries.length === 0) return 2;
  return pickWeighted(entries, (entry) => entry.weight, rng).size;
}

function stationCapacities(input: SimInput, calledOut: Set<string>): Record<string, number> {
  // Effective parallel capacity per station. A single cook is not one burner:
  // the saute station runs several pans, the grill several cuts. These numbers
  // are calibrated so a fully staffed Friday seats roughly 85–90% of demand;
  // callouts and a closed patio then show up as real, explainable pressure.
  const capacities: Record<string, number> = {
    grill: 3.2,
    saute: 3.2,
    fry: 2,
    cold: 1.4,
    bar: 1,
  };
  let chefActive = false;
  for (const member of input.staff) {
    if (!member.active || calledOut.has(member.id)) continue;
    if (member.role === "chef") chefActive = true;
    if (member.role === "server" && member.sectionId === "section-bar") {
      capacities.bar = (capacities.bar ?? 0) + 0.5;
    }
    if (!member.station) continue;
    const station = member.station;
    if (!(station in capacities)) continue;
    if (member.role === "cook") capacities[station] = (capacities[station] ?? 0) + 1.8;
    else if (member.role === "prep") capacities[station] = (capacities[station] ?? 0) + 0.8;
    else if (member.role === "chef") capacities[station] = (capacities[station] ?? 0) + 0.4;
  }
  if (chefActive) {
    for (const station of STATIONS) capacities[station] = (capacities[station] ?? 0) + 0.4;
  }
  return capacities;
}

function chooseOrderItems(
  party: Party,
  menu: SimMenuItem[],
  rng: () => number,
): SimMenuItem[] {
  const active = menu.filter((item) => item.active);
  if (active.length === 0) return [];
  const mains = active.filter((item) => item.category === "main");
  const starters = active.filter((item) => item.category === "starter");
  const desserts = active.filter((item) => item.category === "dessert");
  const sides = active.filter((item) => item.category === "side");
  const drinks = active.filter((item) => ["cocktail", "wine", "coffee"].includes(item.category));
  const items: SimMenuItem[] = [];

  const mainPool = mains.length > 0 ? mains : active;
  for (let guest = 0; guest < party.size; guest += 1) {
    items.push(pickWeighted(mainPool, (item) => 1 / Math.max(10, item.price), rng));
  }
  const starterCount = party.size >= 4 ? 2 : party.size >= 2 ? 1 : 0;
  for (let i = 0; i < starterCount; i += 1) {
    if (starters.length > 0 && rng() < 0.62) {
      items.push(pickWeighted(starters, () => 1, rng));
    }
  }
  if (sides.length > 0 && party.size >= 3 && rng() < 0.45) {
    items.push(pickWeighted(sides, () => 1, rng));
  }
  for (let guest = 0; guest < party.size; guest += 1) {
    if (desserts.length > 0 && rng() < 0.33) {
      items.push(pickWeighted(desserts, () => 1, rng));
    }
    if (drinks.length > 0 && rng() < 0.72) {
      items.push(pickWeighted(drinks, () => 1, rng));
    }
  }
  return items;
}

export function runSimulation(input: SimInput): SimResult {
  const seed = input.seed;
  const rng = mulberry32(seed);
  const calledOut = new Set(input.callouts);
  const capacities = stationCapacities(input, calledOut);
  const sectionNames = new Map(input.sections.map((section) => [section.id, section.name]));
  const activeTables = input.tables.filter((table) => {
    if (!table.active) return false;
    if (input.patioClosed && table.sectionId === "section-patio") return false;
    return true;
  });
  const tables: TableState[] = activeTables.map((table) => ({
    id: table.id,
    label: table.label,
    sectionId: table.sectionId,
    seats: table.seats,
    status: "free",
  }));

  const servers: ServerState[] = input.staff
    .filter(
      (member) =>
        member.active &&
        member.role === "server" &&
        !calledOut.has(member.id),
    )
    .map((member) => ({
      id: member.id,
      name: member.name,
      sectionId: member.sectionId,
      tables: new Set<string>(),
      seats: 0,
      maxTables: Math.max(1, member.maxTables),
      maxSeats: Math.max(1, member.maxSeats),
      shiftStart: parseClock(member.shiftStart),
      shiftEnd: parseClock(member.shiftEnd),
      hourlyRate: member.hourlyRate,
    }));

  const serverBySection = new Map<string, ServerState[]>();
  for (const server of servers) {
    if (!server.sectionId) continue;
    const list = serverBySection.get(server.sectionId) ?? [];
    list.push(server);
    serverBySection.set(server.sectionId, list);
  }

  // Generate arrivals.
  const curve = [...input.demand.curve]
    .map((bucket) => ({ minute: parseClock(bucket.time), covers: bucket.covers }))
    .sort((a, b) => a.minute - b.minute);
  const parties: Party[] = [];
  let noShows = 0;
  let partySeq = 0;
  for (const bucket of curve) {
    const expected = Math.max(0, bucket.covers * input.demandMultiplier);
    if (expected <= 0) continue;
    let remaining = poisson(expected, rng);
    let guard = 0;
    while (remaining > 0 && guard < 80) {
      guard += 1;
      const size = Math.min(remaining, Math.max(1, partySizeFromMix(input.demand.partyMix, rng)));
      const arrival = bucket.minute + Math.floor(rng() * 15);
      if (rng() < input.demand.noShowRate) {
        noShows += 1;
      } else {
        partySeq += 1;
        parties.push({
          id: `party-${partySeq}`,
          size,
          arrival,
          waitStarted: arrival,
          status: "waiting",
        });
      }
      remaining -= size;
    }
  }
  parties.sort((a, b) => a.arrival - b.arrival || a.id.localeCompare(b.id));

  const stationSlots: Record<string, { available: number[]; capacity: number }> = {};
  const stationMaxQueue: Record<string, { queue: number; at: number; totalDelay: number }> = {};
  for (const station of STATIONS) {
    const capacity = Math.max(0.15, capacities[station] ?? 0.35);
    // A station with capacity 3.1 runs as four parallel channels, each at
    // 3.1/4 of the station's throughput. This avoids the unrealistic serial
    // queue a single-channel model produces at peak.
    const slots = Math.max(1, Math.round(capacity));
    stationSlots[station] = { available: Array.from({ length: slots }, () => OPEN_MINUTE), capacity };
    stationMaxQueue[station] = { queue: 0, at: OPEN_MINUTE, totalDelay: 0 };
  }

  const delaysByTable = new Map<string, number[]>();
  const coversByTable = new Map<string, number>();
  const occupiedByTable = new Map<string, number>();
  for (const table of tables) {
    delaysByTable.set(table.id, []);
    coversByTable.set(table.id, 0);
    occupiedByTable.set(table.id, 0);
  }
  const waiting: Party[] = [];
  const events: SimEvent[] = [];
  const timeline: TimelinePoint[] = [];
  const waits: number[] = [];
  const seatedWaitsBySection = new Map<string, number[]>();
  const ticketTimes: number[] = [];
  const tableTurns = new Map<string, number>();
  let coversRequested = 0;
  let coversSeated = 0;
  let coversWalked = 0;
  let partiesSeated = 0;
  let walkouts = 0;
  let revenue = 0;
  let contribution = 0;
  let occupiedTableMinutes = 0;
  let lastBusMinute = OPEN_MINUTE;
  let arrivalSeq = 0;
  let seatedSincePoint = 0;
  let arrivalsSincePoint = 0;
  let nextTimelinePoint = OPEN_MINUTE;
  let cumulativeWaitSum = 0;
  let cumulativeWaitCount = 0;

  for (const party of parties) coversRequested += party.size;

  function log(event: Omit<SimEvent, "t" | "label"> & { t: number }) {
    if (events.length >= 240) return;
    events.push({ ...event, label: clockLabel(event.t) });
  }

  function serverForTable(table: TableState): ServerState | null {
    if (!table.sectionId) return null;
    const candidates = (serverBySection.get(table.sectionId) ?? []).filter(
      (server) =>
        server.tables.size < server.maxTables &&
        server.seats + 1 <= server.maxSeats &&
        server.shiftStart <= currentMinute &&
        server.shiftEnd >= currentMinute,
    );
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => a.tables.size - b.tables.size || a.seats - b.seats)[0] ?? null;
  }

  function findTable(party: Party): { table: TableState; server: ServerState } | null {
    const candidates = tables
      .filter((table) => table.status === "free" && table.seats >= party.size)
      .sort((a, b) => a.seats - b.seats || a.id.localeCompare(b.id));
    for (const table of candidates) {
      const server = serverForTable(table);
      if (!server) continue;
      if (server.tables.size >= server.maxTables) continue;
      if (server.seats + party.size > server.maxSeats) continue;
      return { table, server };
    }
    return null;
  }

  function seatParty(party: Party, table: TableState, server: ServerState, minute: number) {
    party.status = "seated";
    party.tableId = table.id;
    party.sectionId = table.sectionId;
    party.seatedAt = minute;
    party.wait = Math.max(0, minute - party.arrival);
    waits.push(party.wait);
    cumulativeWaitSum += party.wait;
    cumulativeWaitCount += 1;
    const sectionKey = table.sectionId ?? "unassigned";
    const sectionWaits = seatedWaitsBySection.get(sectionKey) ?? [];
    sectionWaits.push(party.wait);
    seatedWaitsBySection.set(sectionKey, sectionWaits);
    delaysByTable.set(table.id, [...(delaysByTable.get(table.id) ?? []), party.wait]);
    coversByTable.set(table.id, (coversByTable.get(table.id) ?? 0) + party.size);

    table.status = "seated";
    table.partyId = party.id;
    table.serverId = server.id;
    table.seatedAt = minute;
    table.orderAt = minute + 3;
    server.tables.add(table.id);
    server.seats += party.size;
    coversSeated += party.size;
    partiesSeated += 1;
    seatedSincePoint += 1;
    tableTurns.set(table.id, (tableTurns.get(table.id) ?? 0) + 1);
    if (party.wait >= 18) {
      log({
        t: minute,
        type: "wait",
        severity: party.wait >= 30 ? "danger" : "warn",
        detail: `Party of ${party.size} seated at ${table.label} after ${Math.round(party.wait)} min.`,
        tableId: table.id,
      });
    }
  }

  function placeOrder(table: TableState, minute: number) {
    const party = parties.find((candidate) => candidate.id === table.partyId);
    if (!party) return;
    const items = chooseOrderItems(party, input.menu, rng);
    let readyAt = minute;
    for (const item of items) {
      const station = item.station in stationSlots ? item.station : "saute";
      const channel = stationSlots[station]!;
      const slotCount = channel.available.length;
      let slotIndex = 0;
      for (let index = 1; index < slotCount; index += 1) {
        if (channel.available[index]! < channel.available[slotIndex]!) slotIndex = index;
      }
      const start = Math.max(minute, channel.available[slotIndex]!);
      const perChannelCapacity = channel.capacity / slotCount;
      const duration = (item.prepMinutes + item.cookMinutes) / Math.max(0.15, perChannelCapacity);
      const finish = start + duration + 0.35;
      channel.available[slotIndex] = finish;
      const wait = Math.max(0, start - minute);
      const stationRecord = stationMaxQueue[station]!;
      if (wait > stationRecord.queue) {
        stationRecord.queue = wait;
        stationRecord.at = minute;
      }
      stationRecord.totalDelay += wait;
      readyAt = Math.max(readyAt, finish);
      revenue += item.price;
      contribution += item.price * item.margin;
    }
    const passCapacity = 1 + (calledOut.has("staff-sam") ? 0 : 0.6) + (calledOut.has("staff-nora") ? 0 : 0.4);
    readyAt += 1.8 / passCapacity;
    const foodAt = Math.ceil(readyAt);
    const eatMinutes = 15 + party.size * 2.2;
    table.foodAt = foodAt;
    table.finishAt = Math.ceil(foodAt + eatMinutes);
    table.busAt = (table.finishAt ?? foodAt) + 12;
    lastBusMinute = Math.max(lastBusMinute, table.busAt);
    const ticketTime = foodAt - minute;
    ticketTimes.push(ticketTime);
    if (ticketTime >= 24) {
      log({
        t: minute,
        type: "ticket",
        severity: ticketTime >= 36 ? "danger" : "warn",
        detail: `${table.label} ticket took ${Math.round(ticketTime)} min to reach the pass.`,
        tableId: table.id,
      });
    }
  }

  let currentMinute = OPEN_MINUTE;
  for (currentMinute = OPEN_MINUTE; currentMinute <= END_MINUTE; currentMinute += 1) {
    // 1. Finish orders and free tables.
    for (const table of tables) {
      if (table.status === "seated" && table.orderAt === currentMinute) {
        placeOrder(table, currentMinute);
      }
      if (table.status === "seated" && table.busAt !== undefined && table.busAt === currentMinute) {
        const party = parties.find((candidate) => candidate.id === table.partyId);
        const server = servers.find((candidate) => candidate.id === table.serverId);
        if (server) {
          server.tables.delete(table.id);
          server.seats = Math.max(0, server.seats - (party?.size ?? 0));
        }
        occupiedTableMinutes += Math.max(0, currentMinute - (table.seatedAt ?? currentMinute));
        occupiedByTable.set(
          table.id,
          (occupiedByTable.get(table.id) ?? 0) + Math.max(0, currentMinute - (table.seatedAt ?? currentMinute)),
        );
        if (party) party.status = "done";
        table.status = "free";
        delete table.partyId;
        delete table.serverId;
        delete table.seatedAt;
        delete table.orderAt;
        delete table.foodAt;
        delete table.finishAt;
        delete table.busAt;
      }
    }

    // 2. Add arrivals.
    while (arrivalSeq < parties.length && parties[arrivalSeq]!.arrival <= currentMinute) {
      const party = parties[arrivalSeq]!;
      if (party.arrival === currentMinute) {
        waiting.push(party);
        arrivalsSincePoint += 1;
      }
      arrivalSeq += 1;
    }

    // 3. Seat waiting parties, oldest first.
    for (let index = 0; index < waiting.length; index += 1) {
      const party = waiting[index]!;
      if (party.status !== "waiting") continue;
      if (currentMinute - party.arrival > input.demand.walkoutThresholdMin) {
        party.status = "walked";
        coversWalked += party.size;
        walkouts += 1;
        waits.push(currentMinute - party.arrival);
        log({
          t: currentMinute,
          type: "walkout",
          severity: "danger",
          detail: `Party of ${party.size} walked after ${Math.round(currentMinute - party.arrival)} min; no ${party.size}-top available with server capacity.`,
        });
        waiting.splice(index, 1);
        index -= 1;
        continue;
      }
      const match = findTable(party);
      if (!match) continue;
      seatParty(party, match.table, match.server, currentMinute);
      waiting.splice(index, 1);
      index -= 1;
    }

    // 4. Timeline every 5 minutes.
    if (currentMinute >= nextTimelinePoint || currentMinute === END_MINUTE) {
      const occupied = tables.filter((table) => table.status === "seated").length;
      const kitchenQueue = Math.max(
        0,
        Math.min(...STATIONS.map((station) => Math.min(...stationSlots[station]!.available) - currentMinute)),
      );
      const cumulativeWait = cumulativeWaitCount > 0 ? cumulativeWaitSum / cumulativeWaitCount : 0;
      timeline.push({
        t: currentMinute,
        label: clockLabel(currentMinute),
        arrivals: arrivalsSincePoint,
        seated: seatedSincePoint,
        waiting: waiting.filter((party) => party.status === "waiting").length,
        occupied,
        kitchenQueue: round(kitchenQueue, 1),
        avgWait: round(cumulativeWait, 1),
        walkouts,
        covers: coversSeated,
      });
      arrivalsSincePoint = 0;
      seatedSincePoint = 0;
      nextTimelinePoint += 5;
    }
  }

  // The service window is over. Anyone still waiting walked.
  for (const party of waiting) {
    if (party.status !== "waiting") continue;
    party.status = "walked";
    coversWalked += party.size;
    walkouts += 1;
  }

  // Labor. Scheduled hours plus the overtime premium after a shift ends.
  let laborCost = 0;
  let overtimeMinutes = 0;
  for (const member of input.staff) {
    if (!member.active || calledOut.has(member.id)) continue;
    const shiftStart = parseClock(member.shiftStart);
    const shiftEnd = parseClock(member.shiftEnd);
    const scheduledMinutes = Math.max(0, shiftEnd - shiftStart);
    laborCost += (scheduledMinutes / 60) * member.hourlyRate;
    const overtime = Math.max(0, Math.min(120, lastBusMinute - shiftEnd));
    if (overtime > 0) {
      overtimeMinutes += overtime;
      laborCost += (overtime / 60) * member.hourlyRate * 0.5;
    }
  }

  const stationLoad = STATIONS.map((station) => ({
    station,
    maxQueue: round(stationMaxQueue[station]!.queue, 1),
    at: clockLabel(stationMaxQueue[station]!.at),
    totalDelay: Math.round(stationMaxQueue[station]!.totalDelay),
  })).sort((a, b) => b.maxQueue - a.maxQueue);
  const bottleneck = stationLoad[0];

  const sectionWaits = input.sections
    .map((section) => {
      const values = seatedWaitsBySection.get(section.id) ?? [];
      return {
        sectionId: section.id,
        sectionName: section.name,
        avgWait: round(average(values), 1),
        p95Wait: round(percentile(values, 95), 1),
        seated: values.length,
      };
    })
    .filter((section) => section.seated > 0);

  const sectionNameById = new Map(input.sections.map((section) => [section.id, section.name]));
  const tableStats = activeTables
    .map((table) => {
      const values = delaysByTable.get(table.id) ?? [];
      return {
        tableId: table.id,
        label: table.label,
        sectionId: table.sectionId,
        sectionName: table.sectionId ? sectionNameById.get(table.sectionId) ?? "Unassigned" : "Unassigned",
        seats: table.seats,
        parties: values.length,
        covers: coversByTable.get(table.id) ?? 0,
        avgWait: round(average(values), 1),
        p95Wait: round(percentile(values, 95), 1),
        occupiedMinutes: occupiedByTable.get(table.id) ?? 0,
        utilization: round((occupiedByTable.get(table.id) ?? 0) / SERVICE_MINUTES, 3),
      };
    })
    .sort((a, b) => b.parties - a.parties || a.label.localeCompare(b.label));

  const metrics: SimMetrics = {
    coversRequested,
    coversSeated,
    coversWalked,
    noShows,
    parties: parties.length + noShows,
    partiesSeated,
    walkouts,
    avgWait: round(average(waits), 1),
    p95Wait: round(percentile(waits, 95), 1),
    maxWait: round(Math.max(0, ...waits), 1),
    tableTurns: round(partiesSeated / Math.max(1, activeTables.length), 2),
    utilization: round(occupiedTableMinutes / Math.max(1, activeTables.length * SERVICE_MINUTES), 3),
    revenue: Math.round(revenue),
    contribution: Math.round(contribution),
    laborCost: Math.round(laborCost),
    net: Math.round(contribution - laborCost),
    kitchenP95: round(percentile(ticketTimes, 95), 1),
    kitchenMax: round(Math.max(0, ...ticketTimes), 1),
    bottleneck: bottleneck?.station ?? "none",
    bottleneckAt: bottleneck?.at ?? clockLabel(OPEN_MINUTE),
    overtimeMinutes: Math.round(overtimeMinutes),
    avgTicket: round(average(ticketTimes), 1),
    coversPerServerHour: round(
      coversSeated / Math.max(1, servers.length * Math.max(1, (CLOSE_MINUTE - OPEN_MINUTE) / 60)),
      1,
    ),
    sectionWaits,
    stationLoad,
    tableStats,
  };

  log({
    t: CLOSE_MINUTE,
    type: "summary",
    severity: "info",
    detail: `${coversSeated} covers seated, ${walkouts} walkouts, ${Math.round(metrics.p95Wait)} min P95 wait, ${Math.round(metrics.net).toLocaleString("en-US")} USD net.`,
  });
  if (bottleneck && bottleneck.maxQueue > 12) {
    log({
      t: Math.min(CLOSE_MINUTE, Math.max(OPEN_MINUTE, stationMaxQueue[bottleneck.station]!.at)),
      type: "bottleneck",
      severity: "danger",
      detail: `${bottleneck.station} queue peaked at ${Math.round(bottleneck.maxQueue)} min.`,
      station: bottleneck.station,
    });
  }
  if (overtimeMinutes > 0) {
    log({
      t: CLOSE_MINUTE,
      type: "labor",
      severity: "warn",
      detail: `${Math.round(overtimeMinutes)} staff-minutes of overtime premium.`,
    });
  }

  events.sort((a, b) => a.t - b.t);
  return {
    seed,
    metrics,
    timeline,
    events,
    seedLabel: `seed-${seed}`,
  };
}

export function runMonteCarlo(input: SimInput, replications: number): MonteCarloResult {
  const count = Math.max(1, Math.min(200, Math.round(replications)));
  const baseSeed = input.seed || 20261109;
  const results: SimResult[] = [];
  for (let i = 0; i < count; i += 1) {
    results.push(runSimulation({ ...input, seed: baseSeed + i * 7919 }));
  }
  const picks = (key: keyof SimMetrics) =>
    results.map((result) => Number(result.metrics[key]) || 0);
  const mean = (key: keyof SimMetrics) => round(average(picks(key)), 1);
  const range = (key: keyof SimMetrics): [number, number] => [
    round(percentile(picks(key), 10), 1),
    round(percentile(picks(key), 90), 1),
  ];
  const representative =
    [...results].sort(
      (a, b) => Math.abs(a.metrics.net - mean("net")) - Math.abs(b.metrics.net - mean("net")),
    )[0] ?? results[0]!;
  const baseMetrics = representative.metrics;
  const metrics = {
    ...baseMetrics,
    p95Wait: mean("p95Wait"),
    avgWait: mean("avgWait"),
    walkouts: mean("walkouts"),
    coversSeated: mean("coversSeated"),
    coversWalked: mean("coversWalked"),
    revenue: mean("revenue"),
    contribution: mean("contribution"),
    laborCost: mean("laborCost"),
    net: mean("net"),
    kitchenP95: mean("kitchenP95"),
    utilization: round(average(picks("utilization")), 3),
    tableTurns: mean("tableTurns"),
    replications: count,
    range: {
      p95Wait: range("p95Wait"),
      net: range("net"),
      walkouts: range("walkouts"),
    },
  };
  return {
    metrics,
    timeline: representative.timeline,
    events: representative.events,
    representativeSeed: representative.seed,
    runs: results.map((result) => ({
      seed: result.seed,
      net: result.metrics.net,
      p95Wait: result.metrics.p95Wait,
      walkouts: result.metrics.walkouts,
    })),
  };
}
