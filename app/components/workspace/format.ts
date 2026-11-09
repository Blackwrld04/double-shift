import type { RunMetrics } from "./workspace-context";

export const SECTION_STYLES: Record<
  string,
  { color: string; soft: string; label: string }
> = {
  "section-main": { color: "#ffffff", soft: "rgba(255, 255, 255, 0.08)", label: "Main room" },
  "section-patio": { color: "#d4d4d4", soft: "rgba(212, 212, 212, 0.07)", label: "Patio" },
  "section-bar": { color: "#a3a3a3", soft: "rgba(163, 163, 163, 0.07)", label: "Bar" },
  "section-private": { color: "#737373", soft: "rgba(115, 115, 115, 0.07)", label: "Private room" },
};

export const SECTION_FALLBACK = {
  color: "#8a8a8a",
  soft: "rgba(138, 138, 138, 0.07)",
  label: "Unassigned",
};

export function sectionStyle(sectionId: string | null | undefined) {
  return (sectionId && SECTION_STYLES[sectionId]) || SECTION_FALLBACK;
}

export function money(value: number | undefined, compact = false): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${Math.round(value)}`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function minutes(value: number | undefined, digits = 0): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}m`;
}

export function percent(value: number | undefined, digits = 0): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function deltaLabel(
  value: number | undefined,
  baseline: number | undefined,
  kind: "minutes" | "money" | "count" | "percent" | "ratio",
): { text: string; tone: "good" | "bad" | "neutral" } {
  if (value === undefined || baseline === undefined) {
    return { text: "no baseline", tone: "neutral" };
  }
  const diff = value - baseline;
  if (Math.abs(diff) < 0.05) return { text: "unchanged", tone: "neutral" };
  const sign = diff > 0 ? "+" : "−";
  const amount =
    kind === "minutes"
      ? `${Math.abs(diff).toFixed(1)}m`
      : kind === "money"
        ? money(Math.abs(diff), true)
        : kind === "percent"
          ? `${Math.abs(diff * 100).toFixed(0)} pts`
          : kind === "ratio"
            ? Math.abs(diff).toFixed(2)
            : `${Math.abs(diff).toFixed(1)}`;
  const lowerIsBetter = kind === "minutes" || kind === "percent" || kind === "count";
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return { text: `${sign}${amount}`, tone: good ? "good" : "bad" };
}

export function runAge(createdAt: string | undefined): string {
  if (!createdAt) return "not run";
  const then = new Date(createdAt).getTime();
  if (Number.isNaN(then)) return "not run";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

export function metricOf(metrics: RunMetrics | undefined, key: keyof RunMetrics): number {
  const value = metrics?.[key];
  return typeof value === "number" ? value : 0;
}

export const CLOCK_TICKS = ["5:00", "6:00", "7:00", "8:00", "9:00", "10:00"];

export function clockFromMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(mins).padStart(2, "0")} ${suffix}`;
}
