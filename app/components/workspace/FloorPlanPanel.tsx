import { focusAgentChat } from "@agent-native/toolkit/app/chat";
import { useActionMutation } from "@agent-native/core/client/hooks";
import {
  IconArrowsMove,
  IconFlame,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { minutes, percent, sectionStyle } from "./format";
import {
  useWorkspace,
  type DiningTable,
  type RunMetrics,
} from "./workspace-context";

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 760;

const ZONES = [
  { id: "section-main", x: 118, y: 116, width: 500, height: 570 },
  { id: "section-patio", x: 690, y: 116, width: 360, height: 430 },
  { id: "section-bar", x: 1012, y: 128, width: 178, height: 500 },
  { id: "section-private", x: 705, y: 548, width: 380, height: 178 },
];

type TableStat = RunMetrics["tableStats"][number];

type DragState = {
  id: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
  moved: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${blue})`;
}

function heatFill(stat: TableStat | undefined): string {
  if (!stat || stat.parties === 0 || !Number.isFinite(stat.utilization)) {
    return "rgba(255, 255, 255, 0.04)";
  }
  const pressure = clamp((stat.utilization - 0.28) / 0.62, 0, 1);
  if (pressure < 0.5) return mix("#3a3a3a", "#8a8a8a", pressure * 2);
  return mix("#8a8a8a", "#ffffff", (pressure - 0.5) * 2);
}

function seatPoints(table: DiningTable): Array<{ x: number; y: number }> {
  const count = Math.max(1, table.seats);
  const points: Array<{ x: number; y: number }> = [];
  if (table.shape === "round") {
    const cx = table.x + table.width / 2;
    const cy = table.y + table.height / 2;
    const radius = Math.min(table.width, table.height) / 2 + 8;
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    return points;
  }
  const w = table.width;
  const h = table.height;
  const perimeter = 2 * (w + h);
  for (let index = 0; index < count; index += 1) {
    const distance = ((index + 0.5) / count) * perimeter;
    let x = table.x;
    let y = table.y;
    if (distance < w) {
      x += distance;
      y -= 8;
    } else if (distance < w + h) {
      x += w + 8;
      y += distance - w;
    } else if (distance < w * 2 + h) {
      x += w - (distance - w - h);
      y += h + 8;
    } else {
      x -= 8;
      y += h - (distance - w * 2 - h);
    }
    points.push({ x, y });
  }
  return points;
}

export function FloorPlanPanel() {
  const {
    workspace,
    run,
    selectedTable,
    selectedTableId,
    selectTable,
    heatmap,
    setHeatmap,
    refresh,
  } = useWorkspace();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const updateTable = useActionMutation("update-table", { uiOnly: true });

  const statsByTable = useMemo(() => {
    const map = new Map<string, TableStat>();
    for (const stat of run?.metrics.tableStats ?? []) map.set(stat.tableId, stat);
    return map;
  }, [run?.metrics.tableStats]);

  const tables = workspace?.tables ?? [];
  const floor = workspace?.floor;
  const sections = workspace?.sections ?? [];
  const staff = workspace?.staff ?? [];

  function clientPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse());
  }

  useEffect(() => {
    if (!drag) return;
    dragRef.current = drag;

    function handleMove(event: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;
      const point = clientPoint(event.clientX, event.clientY);
      if (!point) return;
      const dx = point.x - current.startX;
      const dy = point.y - current.startY;
      const nextX = clamp(current.originX + dx, 8, VIEW_WIDTH - current.width - 8);
      const nextY = clamp(current.originY + dy, 84, VIEW_HEIGHT - current.height - 8);
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        current.moved = true;
        dragRef.current = { ...current, moved: true };
      }
      const next = { id: current.id, x: Math.round(nextX), y: Math.round(nextY) };
      previewRef.current = next;
      setPreview(next);
    }

    function handleUp() {
      const current = dragRef.current;
      const next = previewRef.current;
      if (current && next && current.moved) {
        void updateTable
          .mutateAsync({ tableId: current.id, x: next.x, y: next.y })
          .then(() => refresh())
          .catch(() => {
            // Revert the optimistic preview if the write is rejected.
            setPreview(null);
          });
      }
      dragRef.current = null;
      previewRef.current = null;
      setDrag(null);
      setPreview(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // updateTable and refresh are stable enough for the duration of one drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  function startDrag(event: React.PointerEvent, table: DiningTable) {
    event.stopPropagation();
    selectTable(table.id);
    const point = clientPoint(event.clientX, event.clientY);
    if (!point) return;
    const next: DragState = {
      id: table.id,
      startX: point.x,
      startY: point.y,
      originX: table.x,
      originY: table.y,
      width: table.width,
      height: table.height,
      moved: false,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function setSeats(table: DiningTable, seats: number) {
    void updateTable
      .mutateAsync({ tableId: table.id, seats })
      .then(() => refresh())
      .catch(() => undefined);
  }

  function toggleActive(table: DiningTable) {
    void updateTable
      .mutateAsync({ tableId: table.id, active: !table.active })
      .then(() => refresh())
      .catch(() => undefined);
  }

  const selectedStat = selectedTable ? statsByTable.get(selectedTable.id) : undefined;
  const sectionServers = selectedTable?.sectionId
    ? staff.filter(
        (member) =>
          member.role === "server" &&
          member.sectionId === selectedTable.sectionId &&
          member.active,
      )
    : [];

  return (
    <section className="ds-panel ds-floor-panel">
      <div className="ds-panel-head">
        <div>
          <div className="ds-eyebrow">Spatial twin</div>
          <h2 className="ds-panel-title">Floor plan</h2>
        </div>
        <div className="ds-panel-tools">
          <button
            type="button"
            className="ds-toggle"
            data-active={heatmap ? "true" : "false"}
            onClick={() => setHeatmap(!heatmap)}
          >
            <IconFlame size={14} stroke={1.8} />
            {heatmap ? "Utilization heat" : "Show heatmap"}
          </button>
          <span className="ds-floor-hint">
            <IconArrowsMove size={13} stroke={1.8} /> drag to move
          </span>
        </div>
      </div>

      <div className="ds-floor-canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="ds-floor-svg"
          role="img"
          aria-label="Osteria Nove floor plan"
          onPointerDown={() => selectTable(null)}
        >
          <defs>
            <pattern id="ds-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
            </pattern>
            <filter id="ds-table-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#ds-grid)" />

          {ZONES.map((zone) => {
            const section = sections.find((candidate) => candidate.id === zone.id);
            if (!section) return null;
            const style = sectionStyle(zone.id);
            const count = tables.filter((table) => table.sectionId === zone.id).length;
            return (
              <g key={zone.id}>
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  rx={18}
                  fill={style.soft}
                  stroke={style.color}
                  strokeOpacity={0.22}
                  strokeDasharray="5 7"
                />
                <circle cx={zone.x + 20} cy={zone.y + 22} r={4} fill={style.color} />
                <text x={zone.x + 32} y={zone.y + 26} className="ds-zone-label">
                  {section.name.toUpperCase()}
                </text>
                <text x={zone.x + zone.width - 16} y={zone.y + 26} className="ds-zone-count" textAnchor="end">
                  {count} tables
                </text>
              </g>
            );
          })}

          {workspace?.stations.map((station) => (
            <g key={station.id}>
              <rect
                x={station.x}
                y={station.y}
                width={station.width}
                height={station.height}
                rx={12}
                className="ds-station"
              />
              <text
                x={station.x + station.width / 2}
                y={station.y + station.height / 2 + 4}
                textAnchor="middle"
                className="ds-station-label"
              >
                {station.label}
              </text>
            </g>
          ))}

          <path d="M 540 735 L 610 735" className="ds-entrance-line" />
          <text x={620} y={739} className="ds-entrance-label">
            ENTRANCE
          </text>

          {tables.map((table) => {
            const style = sectionStyle(table.sectionId);
            const stat = statsByTable.get(table.id);
            const position =
              preview && preview.id === table.id ? { x: preview.x, y: preview.y } : { x: table.x, y: table.y };
            const isSelected = selectedTableId === table.id;
            const fill = heatmap ? heatFill(stat) : style.soft;
            const nubs = seatPoints({ ...table, x: position.x, y: position.y });
            const cx = position.x + table.width / 2;
            const cy = position.y + table.height / 2;
            const inactive = !table.active;

            return (
              <g
                key={table.id}
                className="ds-table"
                data-selected={isSelected ? "true" : "false"}
                data-inactive={inactive ? "true" : "false"}
                onPointerDown={(event) => startDrag(event, table)}
                style={{ cursor: drag?.id === table.id ? "grabbing" : "grab" }}
              >
                {nubs.map((point, index) => (
                  <circle
                    key={`${table.id}-seat-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={3.4}
                    fill={inactive ? "rgba(255,255,255,0.12)" : style.color}
                    opacity={inactive ? 0.6 : 0.8}
                  />
                ))}
                {table.shape === "round" ? (
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={table.width / 2}
                    ry={table.height / 2}
                    fill={fill}
                    stroke={isSelected ? "#ffffff" : style.color}
                    strokeWidth={isSelected ? 3 : 1.4}
                    strokeDasharray={inactive ? "5 5" : undefined}
                    filter={isSelected ? "url(#ds-table-glow)" : undefined}
                  />
                ) : (
                  <rect
                    x={position.x}
                    y={position.y}
                    width={table.width}
                    height={table.height}
                    rx={Math.min(18, table.height / 4)}
                    fill={fill}
                    stroke={isSelected ? "#ffffff" : style.color}
                    strokeWidth={isSelected ? 3 : 1.4}
                    strokeDasharray={inactive ? "5 5" : undefined}
                    filter={isSelected ? "url(#ds-table-glow)" : undefined}
                  />
                )}
                <text x={cx} y={cy - 1} textAnchor="middle" className="ds-table-label">
                  {table.label}
                </text>
                <text x={cx} y={cy + 14} textAnchor="middle" className="ds-table-seats">
                  {inactive ? "offline" : `${table.seats} seats`}
                </text>
                {heatmap && stat && stat.parties > 0 ? (
                  <text x={cx} y={cy - 17} textAnchor="middle" className="ds-table-heat">
                    {percent(stat.utilization)}
                  </text>
                ) : null}
              </g>
            );
          })}

          <text x={VIEW_WIDTH - 24} y={VIEW_HEIGHT - 20} textAnchor="end" className="ds-floor-caption">
            {floor?.name ?? "Main floor"}
          </text>
        </svg>

        <div className="ds-floor-legend">
          {sections.map((section) => {
            const style = sectionStyle(section.id);
            return (
              <span key={section.id} className="ds-legend-item">
                <span className="ds-legend-dot" style={{ background: style.color }} />
                {section.name}
              </span>
            );
          })}
          {heatmap ? (
            <span className="ds-heat-legend">
              <span>low</span>
              <span className="ds-heat-gradient" />
              <span>high utilization</span>
            </span>
          ) : (
            <span className="ds-legend-note">{tables.filter((table) => table.active).length} active tables</span>
          )}
        </div>
      </div>

      {selectedTable ? (
        <div className="ds-table-inspector">
          <div className="ds-inspector-id">
            <span
              className="ds-inspector-swatch"
              style={{ background: sectionStyle(selectedTable.sectionId).color }}
            />
            <div>
              <div className="ds-inspector-title">
                Table {selectedTable.label}
                {!selectedTable.active ? <span className="ds-offline-chip">offline</span> : null}
              </div>
              <div className="ds-inspector-sub">
                {sectionStyle(selectedTable.sectionId).label} · {selectedTable.seats} seats
                {sectionServers.length > 0
                  ? ` · ${sectionServers.map((server) => server.name.split(" ")[0]).join(", ")}`
                  : " · no server on shift"}
              </div>
            </div>
          </div>

          <div className="ds-inspector-stats">
            <div>
              <span>Parties</span>
              <strong>{selectedStat?.parties ?? 0}</strong>
            </div>
            <div>
              <span>Covers</span>
              <strong>{selectedStat?.covers ?? 0}</strong>
            </div>
            <div>
              <span>Avg wait</span>
              <strong>{minutes(selectedStat?.avgWait ?? 0, 1)}</strong>
            </div>
            <div>
              <span>P95 wait</span>
              <strong>{minutes(selectedStat?.p95Wait ?? 0, 1)}</strong>
            </div>
            <div>
              <span>Utilization</span>
              <strong>{percent(selectedStat?.utilization ?? 0)}</strong>
            </div>
          </div>

          <div className="ds-inspector-actions">
            <div className="ds-seat-stepper" aria-label="Seat count">
              <button
                type="button"
                onClick={() => setSeats(selectedTable, Math.max(1, selectedTable.seats - 1))}
                disabled={selectedTable.seats <= 1}
                aria-label="Remove a seat"
              >
                <IconMinus size={13} />
              </button>
              <span>{selectedTable.seats}</span>
              <button
                type="button"
                onClick={() => setSeats(selectedTable, Math.min(20, selectedTable.seats + 1))}
                disabled={selectedTable.seats >= 20}
                aria-label="Add a seat"
              >
                <IconPlus size={13} />
              </button>
            </div>
            <button type="button" className="ds-ghost-button" onClick={() => toggleActive(selectedTable)}>
              {selectedTable.active ? "Take offline" : "Activate"}
            </button>
            <button type="button" className="ds-accent-button" onClick={() => focusAgentChat()}>
              Ask the agent
            </button>
          </div>
        </div>
      ) : (
        <div className="ds-floor-emptybar">
          <span>
            <IconArrowsMove size={14} stroke={1.8} /> Select a table to inspect its simulated service. Drag it to
            rearrange the live floor.
          </span>
          <button type="button" className="ds-accent-button" onClick={() => focusAgentChat()}>
            Simulate a layout change
          </button>
        </div>
      )}
    </section>
  );
}
