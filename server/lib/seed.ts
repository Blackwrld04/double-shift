import { getDb, schema } from "../db/index.js";

export const VENUE_ID = "osteria-nove";
export const FLOOR_ID = "osteria-main";
export const BASELINE_SCENARIO_ID = "scenario-friday-baseline";

const SECTION_MAIN = "section-main";
const SECTION_PATIO = "section-patio";
const SECTION_BAR = "section-bar";
const SECTION_PRIVATE = "section-private";

type SeedTable = {
  id: string;
  label: string;
  sectionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "round" | "rect";
  seats: number;
};

const tables: SeedTable[] = [
  // Main dining room
  { id: "t01", label: "T01", sectionId: SECTION_MAIN, x: 150, y: 150, width: 76, height: 76, shape: "round", seats: 2 },
  { id: "t02", label: "T02", sectionId: SECTION_MAIN, x: 250, y: 150, width: 76, height: 76, shape: "round", seats: 2 },
  { id: "t03", label: "T03", sectionId: SECTION_MAIN, x: 150, y: 260, width: 96, height: 96, shape: "rect", seats: 4 },
  { id: "t04", label: "T04", sectionId: SECTION_MAIN, x: 275, y: 260, width: 96, height: 96, shape: "rect", seats: 4 },
  { id: "t05", label: "T05", sectionId: SECTION_MAIN, x: 395, y: 150, width: 76, height: 76, shape: "round", seats: 2 },
  { id: "t06", label: "T06", sectionId: SECTION_MAIN, x: 395, y: 260, width: 96, height: 96, shape: "rect", seats: 4 },
  { id: "t07", label: "T07", sectionId: SECTION_MAIN, x: 165, y: 410, width: 128, height: 92, shape: "rect", seats: 6 },
  { id: "t08", label: "T08", sectionId: SECTION_MAIN, x: 320, y: 410, width: 128, height: 92, shape: "rect", seats: 6 },
  { id: "t09", label: "T09", sectionId: SECTION_MAIN, x: 470, y: 410, width: 96, height: 96, shape: "rect", seats: 4 },
  { id: "t10", label: "T10", sectionId: SECTION_MAIN, x: 130, y: 555, width: 76, height: 76, shape: "round", seats: 2 },
  { id: "t11", label: "T11", sectionId: SECTION_MAIN, x: 260, y: 555, width: 96, height: 96, shape: "rect", seats: 4 },
  { id: "t12", label: "T12", sectionId: SECTION_MAIN, x: 420, y: 555, width: 128, height: 92, shape: "rect", seats: 6 },
  // Patio
  { id: "p01", label: "P01", sectionId: SECTION_PATIO, x: 735, y: 150, width: 76, height: 76, shape: "round", seats: 2 },
  { id: "p02", label: "P02", sectionId: SECTION_PATIO, x: 835, y: 150, width: 76, height: 76, shape: "round", seats: 2 },
  { id: "p03", label: "P03", sectionId: SECTION_PATIO, x: 735, y: 260, width: 96, height: 96, shape: "rect", seats: 4 },
  { id: "p04", label: "P04", sectionId: SECTION_PATIO, x: 860, y: 260, width: 96, height: 96, shape: "rect", seats: 4 },
  { id: "p05", label: "P05", sectionId: SECTION_PATIO, x: 755, y: 410, width: 128, height: 92, shape: "rect", seats: 6 },
  { id: "p06", label: "P06", sectionId: SECTION_PATIO, x: 905, y: 410, width: 96, height: 96, shape: "rect", seats: 4 },
  // Bar
  { id: "b01", label: "B01", sectionId: SECTION_BAR, x: 1060, y: 170, width: 76, height: 76, shape: "round", seats: 2 },
  { id: "b02", label: "B02", sectionId: SECTION_BAR, x: 1060, y: 275, width: 76, height: 76, shape: "round", seats: 2 },
  { id: "b03", label: "B03", sectionId: SECTION_BAR, x: 1060, y: 380, width: 76, height: 76, shape: "round", seats: 2 },
  { id: "b04", label: "B04", sectionId: SECTION_BAR, x: 1045, y: 490, width: 96, height: 96, shape: "rect", seats: 4 },
  // Private room
  { id: "v01", label: "V01", sectionId: SECTION_PRIVATE, x: 745, y: 585, width: 150, height: 100, shape: "rect", seats: 8 },
  { id: "v02", label: "V02", sectionId: SECTION_PRIVATE, x: 925, y: 585, width: 128, height: 92, shape: "rect", seats: 6 },
];

const staff = [
  { id: "staff-maya", name: "Maya Chen", role: "host", station: null, sectionId: null, shiftStart: "16:30", shiftEnd: "23:00", hourlyRate: 22, maxTables: 0, maxSeats: 0 },
  { id: "staff-andre", name: "Andre Silva", role: "server", station: null, sectionId: SECTION_MAIN, shiftStart: "16:30", shiftEnd: "23:00", hourlyRate: 24, maxTables: 4, maxSeats: 18 },
  { id: "staff-priya", name: "Priya Nair", role: "server", station: null, sectionId: SECTION_MAIN, shiftStart: "17:00", shiftEnd: "23:00", hourlyRate: 24, maxTables: 4, maxSeats: 18 },
  { id: "staff-jonah", name: "Jonah Reed", role: "server", station: null, sectionId: SECTION_PATIO, shiftStart: "16:30", shiftEnd: "22:30", hourlyRate: 23, maxTables: 4, maxSeats: 18 },
  { id: "staff-elena", name: "Elena Rossi", role: "server", station: null, sectionId: SECTION_BAR, shiftStart: "17:00", shiftEnd: "23:30", hourlyRate: 24, maxTables: 4, maxSeats: 14 },
  { id: "staff-marcus", name: "Marcus Lee", role: "server", station: null, sectionId: SECTION_PRIVATE, shiftStart: "17:00", shiftEnd: "22:00", hourlyRate: 25, maxTables: 3, maxSeats: 20 },
  { id: "staff-luis", name: "Luis Ortega", role: "busser", station: null, sectionId: null, shiftStart: "17:00", shiftEnd: "23:00", hourlyRate: 18, maxTables: 0, maxSeats: 0 },
  { id: "staff-sam", name: "Sam Patel", role: "expo", station: "pass", sectionId: null, shiftStart: "16:30", shiftEnd: "22:30", hourlyRate: 21, maxTables: 0, maxSeats: 0 },
  { id: "staff-nora", name: "Nora Kim", role: "chef", station: "pass", sectionId: null, shiftStart: "16:00", shiftEnd: "23:00", hourlyRate: 34, maxTables: 0, maxSeats: 0 },
  { id: "staff-diego", name: "Diego Santos", role: "cook", station: "grill", sectionId: null, shiftStart: "16:00", shiftEnd: "23:00", hourlyRate: 26, maxTables: 0, maxSeats: 0 },
  { id: "staff-aisha", name: "Aisha Bello", role: "cook", station: "saute", sectionId: null, shiftStart: "16:00", shiftEnd: "23:00", hourlyRate: 26, maxTables: 0, maxSeats: 0 },
  { id: "staff-tom", name: "Tom Becker", role: "cook", station: "fry", sectionId: null, shiftStart: "16:00", shiftEnd: "23:00", hourlyRate: 22, maxTables: 0, maxSeats: 0 },
  { id: "staff-grace", name: "Grace Wu", role: "prep", station: "cold", sectionId: null, shiftStart: "14:00", shiftEnd: "20:00", hourlyRate: 20, maxTables: 0, maxSeats: 0 },
];

const menu = [
  { id: "menu-burrata", name: "Burrata", category: "starter", station: "cold", prepMinutes: 5, cookMinutes: 0, price: 16, margin: 0.72 },
  { id: "menu-arancini", name: "Arancini", category: "starter", station: "fry", prepMinutes: 3, cookMinutes: 6, price: 14, margin: 0.7 },
  { id: "menu-octopus", name: "Charred Octopus", category: "starter", station: "grill", prepMinutes: 5, cookMinutes: 9, price: 22, margin: 0.64 },
  { id: "menu-rigatoni", name: "Rigatoni alla Vodka", category: "main", station: "saute", prepMinutes: 4, cookMinutes: 9, price: 24, margin: 0.71 },
  { id: "menu-cacio", name: "Cacio e Pepe", category: "main", station: "saute", prepMinutes: 3, cookMinutes: 7, price: 22, margin: 0.73 },
  { id: "menu-branzino", name: "Branzino", category: "main", station: "grill", prepMinutes: 4, cookMinutes: 12, price: 34, margin: 0.62 },
  { id: "menu-chicken", name: "Chicken Milanese", category: "main", station: "fry", prepMinutes: 5, cookMinutes: 9, price: 28, margin: 0.68 },
  { id: "menu-ribeye", name: "Dry-Aged Ribeye", category: "main", station: "grill", prepMinutes: 4, cookMinutes: 16, price: 48, margin: 0.58 },
  { id: "menu-veg", name: "Market Vegetables", category: "side", station: "saute", prepMinutes: 3, cookMinutes: 6, price: 18, margin: 0.74 },
  { id: "menu-tiramisu", name: "Tiramisu", category: "dessert", station: "cold", prepMinutes: 2, cookMinutes: 0, price: 12, margin: 0.78 },
  { id: "menu-panna", name: "Panna Cotta", category: "dessert", station: "cold", prepMinutes: 2, cookMinutes: 0, price: 11, margin: 0.78 },
  { id: "menu-negroni", name: "Negroni", category: "cocktail", station: "bar", prepMinutes: 2, cookMinutes: 0, price: 15, margin: 0.82 },
  { id: "menu-chianti", name: "Chianti Classico", category: "wine", station: "bar", prepMinutes: 1, cookMinutes: 0, price: 14, margin: 0.75 },
  { id: "menu-espresso", name: "Espresso", category: "coffee", station: "bar", prepMinutes: 1, cookMinutes: 0, price: 4, margin: 0.85 },
];

const demandCurve = [
  { time: "17:00", covers: 3 },
  { time: "17:15", covers: 5 },
  { time: "17:30", covers: 7 },
  { time: "17:45", covers: 8 },
  { time: "18:00", covers: 12 },
  { time: "18:15", covers: 14 },
  { time: "18:30", covers: 15 },
  { time: "18:45", covers: 17 },
  { time: "19:00", covers: 15 },
  { time: "19:15", covers: 14 },
  { time: "19:30", covers: 12 },
  { time: "19:45", covers: 10 },
  { time: "20:00", covers: 8 },
  { time: "20:15", covers: 7 },
  { time: "20:30", covers: 5 },
  { time: "20:45", covers: 3 },
  { time: "21:00", covers: 2 },
  { time: "21:15", covers: 2 },
  { time: "21:30", covers: 1 },
];

const partyMix = {
  "1": 0.04,
  "2": 0.44,
  "3": 0.12,
  "4": 0.28,
  "5": 0.05,
  "6": 0.05,
  "7": 0.01,
  "8": 0.01,
};

let seedPromise: Promise<void> | null = null;

async function seedOnce(): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: schema.venues.id }).from(schema.venues).limit(1);
  if (existing.length > 0) return;

  const nowIso = new Date().toISOString();

  await db.insert(schema.venues).values({
    id: VENUE_ID,
    name: "Osteria Nove",
    timezone: "America/New_York",
    currency: "USD",
    address: "9 Bank Street, New York, NY",
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  await db.insert(schema.floors).values({
    id: FLOOR_ID,
    venueId: VENUE_ID,
    name: "Main Floor + Patio",
    width: 1200,
    height: 760,
    createdAt: nowIso,
  });

  await db.insert(schema.sections).values([
    { id: SECTION_MAIN, floorId: FLOOR_ID, name: "Main Room", color: "#ffffff", createdAt: nowIso },
    { id: SECTION_PATIO, floorId: FLOOR_ID, name: "Patio", color: "#d4d4d4", createdAt: nowIso },
    { id: SECTION_BAR, floorId: FLOOR_ID, name: "Bar", color: "#a3a3a3", createdAt: nowIso },
    { id: SECTION_PRIVATE, floorId: FLOOR_ID, name: "Private Room", color: "#737373", createdAt: nowIso },
  ]);

  await db.insert(schema.diningTables).values(
    tables.map((t) => ({
      ...t,
      floorId: FLOOR_ID,
      active: true,
      notes: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    })),
  );

  await db.insert(schema.stations).values([
    { id: "station-pass", floorId: FLOOR_ID, kind: "pass", label: "Pass / Expo", x: 540, y: 55, width: 150, height: 58, capacity: 1, createdAt: nowIso },
    { id: "station-kitchen", floorId: FLOOR_ID, kind: "kitchen", label: "Kitchen", x: 360, y: 55, width: 160, height: 58, capacity: 3, createdAt: nowIso },
    { id: "station-bar", floorId: FLOOR_ID, kind: "bar", label: "Bar", x: 1030, y: 70, width: 130, height: 58, capacity: 2, createdAt: nowIso },
    { id: "station-host", floorId: FLOOR_ID, kind: "host", label: "Host Stand", x: 540, y: 685, width: 140, height: 50, capacity: 1, createdAt: nowIso },
  ]);

  await db.insert(schema.staff).values(
    staff.map((s) => ({
      ...s,
      venueId: VENUE_ID,
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    })),
  );

  await db.insert(schema.menuItems).values(
    menu.map((m) => ({
      ...m,
      venueId: VENUE_ID,
      active: true,
      createdAt: nowIso,
    })),
  );

  await db.insert(schema.demandProfiles).values({
    id: "demand-friday",
    venueId: VENUE_ID,
    name: "Friday Dinner",
    dayOfWeek: "friday",
    startTime: "17:00",
    endTime: "22:30",
    covers: 160,
    curveJson: JSON.stringify(demandCurve),
    partyMixJson: JSON.stringify(partyMix),
    noShowRate: 0.06,
    walkoutThresholdMin: 28,
    weather: "clear",
    notes: "A typical Friday. Bar and patio both open.",
    createdAt: nowIso,
  });

  await db.insert(schema.scenarios).values([
    {
      id: BASELINE_SCENARIO_ID,
      venueId: VENUE_ID,
      demandProfileId: "demand-friday",
      name: "Friday baseline",
      description: "Current floor plan and full staffing. The plan we run today.",
      demandMultiplier: 1,
      patioClosed: false,
      calloutsJson: "[]",
      status: "baseline",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: "scenario-rain-callouts",
      venueId: VENUE_ID,
      demandProfileId: "demand-friday",
      name: "Rain + 2 callouts",
      description: "Patio closed for rain, Priya and Tom called out. Indoor demand up 5%.",
      demandMultiplier: 1.05,
      patioClosed: true,
      calloutsJson: JSON.stringify(["staff-priya", "staff-tom"]),
      status: "draft",
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ]);
}

export function ensureSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedOnce().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}
