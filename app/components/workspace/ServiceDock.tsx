import { useActionMutation } from "@agent-native/core/client/hooks";
import { focusAgentChat } from "@agent-native/toolkit/app/chat";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCheck,
  IconChefHat,
  IconClock,
  IconLayoutList,
  IconClipboardCheck,
  IconTimeline,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { money, minutes, percent, runAge, sectionStyle } from "./format";
import {
  useWorkspace,
  type Proposal,
  type RunEvent,
  type RunMetrics,
} from "./workspace-context";

const TABS = [
  { id: "timeline", label: "Service", icon: IconTimeline },
  { id: "proposals", label: "Proposals", icon: IconLayoutList },
  { id: "staff", label: "Team", icon: IconUsers },
] as const;

function heatColor(value: number, max: number): string {
  const t = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const v = Math.round(70 + (240 - 70) * t);
  return `rgb(${v}, ${v}, ${v})`;
}

function SeverityDot({ severity }: { severity: RunEvent["severity"] }) {
  return <span className="ds-severity-dot" data-severity={severity} />;
}

function TimelineTab() {
  const { run, selectedScenario, workspace, baselineMetrics } = useWorkspace();
  const metrics = run?.metrics ?? selectedScenario?.latestRun?.metrics;
  const points = (run?.timeline ?? []).filter((point) => point.t <= 1350);
  const events = (run?.events ?? []).filter((event) => event.type !== "summary");
  const recent = [...events].sort((a, b) => b.t - a.t).slice(0, 7);

  const chart = useMemo(() => {
    const width = 360;
    const height = 160;
    const pad = { top: 12, right: 4, bottom: 22, left: 4 };
    const start = 1020;
    const end = 1350;
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const maxWaiting = Math.max(4, ...points.map((point) => point.waiting));
    const maxQueue = Math.max(10, ...points.map((point) => point.kitchenQueue));
    const x = (t: number) => pad.left + ((t - start) / (end - start)) * plotWidth;
    const y = (value: number, max: number) => pad.top + plotHeight - (value / max) * plotHeight;
    const waitingPath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.t).toFixed(1)} ${y(point.waiting, maxWaiting).toFixed(1)}`)
      .join(" ");
    const waitingArea =
      points.length > 0
        ? `${waitingPath} L ${x(points[points.length - 1]!.t).toFixed(1)} ${pad.top + plotHeight} L ${x(points[0]!.t).toFixed(1)} ${pad.top + plotHeight} Z`
        : "";
    const queuePath = points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${x(point.t).toFixed(1)} ${y(point.kitchenQueue, maxQueue).toFixed(1)}`,
      )
      .join(" ");
    return { width, height, pad, plotHeight, x, y, waitingArea, queuePath, maxWaiting, start, end };
  }, [points]);

  if (!metrics) {
    return <DockEmpty icon={IconTimeline} title="No service run yet" body="Run a scenario to see the timeline, stations and events." />;
  }

  const bottleneck = metrics.stationLoad?.[0];
  const baselineP95 = baselineMetrics?.p95Wait;

  return (
    <div className="ds-dock-scroll">
      <div className="ds-insight">
        <div className="ds-insight-icon" data-tone={bottleneck && bottleneck.maxQueue > 18 ? "bad" : "good"}>
          {bottleneck && bottleneck.maxQueue > 18 ? (
            <IconAlertTriangle size={18} stroke={1.8} />
          ) : (
            <IconCheck size={18} stroke={1.8} />
          )}
        </div>
        <div className="ds-insight-copy">
          <div className="ds-insight-title">
            {bottleneck && bottleneck.maxQueue > 18
              ? `${bottleneck.station} is the constraint`
              : "The kitchen is keeping up"}
          </div>
          <p>
            {bottleneck && bottleneck.maxQueue > 18
              ? `Queue peaked at ${minutes(bottleneck.maxQueue)} around ${bottleneck.at}. Kitchen P95 is ${minutes(metrics.kitchenP95)}.`
              : `No station queue crossed 18 minutes. Kitchen P95 is ${minutes(metrics.kitchenP95)}.`}
          </p>
        </div>
        <div className="ds-insight-number">
          <span>P95</span>
          <strong>{minutes(metrics.p95Wait)}</strong>
          {baselineP95 !== undefined && selectedScenario?.status !== "baseline" ? (
            <em data-tone={metrics.p95Wait <= baselineP95 ? "good" : "bad"}>
              {metrics.p95Wait <= baselineP95 ? "−" : "+"}
              {Math.abs(metrics.p95Wait - baselineP95).toFixed(1)}m vs base
            </em>
          ) : null}
        </div>
      </div>

      <div className="ds-scenario-strip">
        <div className="ds-scenario-strip-main">
          <span className="ds-mini-label">Scenario</span>
          <strong>{selectedScenario?.name ?? "Baseline"}</strong>
        </div>
        <div className="ds-scenario-tags">
          <span>{selectedScenario?.demandMultiplier === 1 ? "1.0× demand" : `${selectedScenario?.demandMultiplier.toFixed(2)}× demand`}</span>
          {selectedScenario?.patioClosed ? <span className="ds-tag-warn">patio closed</span> : <span>patio open</span>}
          {selectedScenario?.callouts.length ? (
            <span className="ds-tag-warn">{selectedScenario.callouts.length} callouts</span>
          ) : (
            <span>full team</span>
          )}
        </div>
      </div>

      <div className="ds-chart-card">
        <div className="ds-chart-head">
          <div>
            <span className="ds-mini-label">Waiting room</span>
            <strong>{metricLabel(metrics, "guests")}</strong>
          </div>
          <div className="ds-chart-legend">
            <span className="ds-chart-key ds-chart-key-wait">waiting</span>
            <span className="ds-chart-key ds-chart-key-queue">kitchen queue</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="ds-timeline-svg" role="img" aria-label="Service timeline">
          <defs>
            <linearGradient id="ds-wait-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line
              key={fraction}
              x1={chart.pad.left}
              x2={chart.width - chart.pad.right}
              y1={chart.pad.top + chart.plotHeight * fraction}
              y2={chart.pad.top + chart.plotHeight * fraction}
              className="ds-chart-gridline"
            />
          ))}
          <path d={chart.waitingArea} fill="url(#ds-wait-fill)" />
          <path d={chart.queuePath} fill="none" className="ds-chart-queue-line" />
          {[1020, 1140, 1260, 1350].map((tick) => (
            <text key={tick} x={chart.x(tick)} y={chart.height - 6} textAnchor={tick === 1350 ? "end" : "middle"} className="ds-chart-tick">
              {tick === 1020 ? "5 PM" : tick === 1140 ? "7 PM" : tick === 1260 ? "9 PM" : "10:30"}
            </text>
          ))}
        </svg>
        <div className="ds-heat-strip" aria-label="Wait heat by five minute bucket">
          {points.map((point) => (
            <span
              key={point.t}
              className="ds-heat-cell"
              style={{ background: heatColor(point.avgWait, 30) }}
              title={`${point.label} · ${point.avgWait} min average wait`}
            />
          ))}
        </div>
        <div className="ds-heat-labels">
          <span>5:00</span>
          <span>wait heat</span>
          <span>10:30</span>
        </div>
      </div>

      <div className="ds-card-block">
        <div className="ds-block-head">
          <span className="ds-mini-label">Station load</span>
          <span className="ds-block-note">peak wait</span>
        </div>
        <div className="ds-station-list">
          {(metrics.stationLoad ?? []).map((station) => {
            const max = Math.max(1, ...(metrics.stationLoad ?? []).map((item) => item.maxQueue));
            return (
              <div className="ds-station-row" key={station.station}>
                <span className="ds-station-name">{station.station}</span>
                <div className="ds-station-track">
                  <span style={{ width: `${Math.max(3, (station.maxQueue / max) * 100)}%` }} />
                </div>
                <span className="ds-station-value">{minutes(station.maxQueue)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ds-card-block">
        <div className="ds-block-head">
          <span className="ds-mini-label">Section wait</span>
          <span className="ds-block-note">P95 · seated parties</span>
        </div>
        <div className="ds-section-list">
          {(metrics.sectionWaits ?? []).map((section) => {
            const style = sectionStyle(section.sectionId);
            const max = Math.max(1, ...(metrics.sectionWaits ?? []).map((item) => item.p95Wait));
            return (
              <div className="ds-section-row" key={section.sectionId}>
                <span className="ds-section-dot" style={{ background: style.color }} />
                <span className="ds-section-name">{section.sectionName}</span>
                <div className="ds-section-track">
                  <span style={{ width: `${Math.max(4, (section.p95Wait / max) * 100)}%`, background: style.color }} />
                </div>
                <span className="ds-section-value">{minutes(section.p95Wait)}</span>
                <span className="ds-section-seated">{section.seated}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ds-card-block">
        <div className="ds-block-head">
          <span className="ds-mini-label">Kitchen evidence</span>
          <span className="ds-block-note">latest events</span>
        </div>
        <div className="ds-event-list">
          {recent.length === 0 ? (
            <div className="ds-event-empty">No events crossed a threshold.</div>
          ) : (
            recent.map((event, index) => (
              <div className="ds-event-row" key={`${event.t}-${event.type}-${index}`}>
                <SeverityDot severity={event.severity} />
                <span className="ds-event-time">{event.label}</span>
                <span className="ds-event-text">{event.detail}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function metricLabel(metrics: RunMetrics, _kind: string): string {
  return `${Math.round(metrics.coversSeated)} covers · ${Math.round(metrics.walkouts)} walkouts`;
}

function expectedNumber(proposal: Proposal, key: string): number | undefined {
  const value = (proposal.expected as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function expectedRange(proposal: Proposal, key: string): [number, number] | undefined {
  const range = (proposal.expected as { range?: Record<string, unknown> }).range;
  const value = range?.[key];
  if (Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number") {
    return [value[0], value[1]];
  }
  return undefined;
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { refresh } = useWorkspace();
  const applyProposal = useActionMutation("apply-proposal", { uiOnly: true });
  const rejectProposal = useActionMutation("reject-proposal", { uiOnly: true });
  const [acting, setActing] = useState<"apply" | "reject" | null>(null);
  const [showChanges, setShowChanges] = useState(false);

  const p95 = expectedNumber(proposal, "p95Wait");
  const walkouts = expectedNumber(proposal, "walkouts");
  const net = expectedNumber(proposal, "net");
  const replications = expectedNumber(proposal, "replications");
  const p95Range = expectedRange(proposal, "p95Wait");
  const walkoutRange = expectedRange(proposal, "walkouts");
  const netRange = expectedRange(proposal, "net");

  async function act(kind: "apply" | "reject") {
    setActing(kind);
    try {
      if (kind === "apply") {
        await applyProposal.mutateAsync({ proposalId: proposal.id });
      } else {
        await rejectProposal.mutateAsync({ proposalId: proposal.id });
      }
      await refresh();
    } finally {
      setActing(null);
    }
  }

  return (
    <article className="ds-proposal-card">
      <div className="ds-proposal-top">
        <div>
          <div className="ds-proposal-kicker">
            <span className="ds-agent-chip">
              Agent staged
            </span>
            <span className="ds-proposal-age">{runAge(proposal.createdAt)}</span>
          </div>
          <h3>{proposal.title}</h3>
        </div>
        <span className="ds-approval-badge">needs human</span>
      </div>
      {proposal.summary ? <p className="ds-proposal-summary">{proposal.summary}</p> : null}

      <div className="ds-proposal-metrics">
        <div>
          <span>P95 wait</span>
          <strong>{p95 !== undefined ? minutes(p95) : "—"}</strong>
          <em className="ds-range">{p95Range ? `${p95Range[0]}–${p95Range[1]}m` : "simulated"}</em>
        </div>
        <div>
          <span>Walkouts</span>
          <strong>{walkouts !== undefined ? Math.round(walkouts) : "—"}</strong>
          <em className="ds-range">{walkoutRange ? `${Math.round(walkoutRange[0])}–${Math.round(walkoutRange[1])}` : "simulated"}</em>
        </div>
        <div>
          <span>Net</span>
          <strong>{net !== undefined ? money(net, true) : "—"}</strong>
          <em className="ds-range">{netRange ? `${money(netRange[0], true)}–${money(netRange[1], true)}` : "simulated"}</em>
        </div>
      </div>

      <button type="button" className="ds-change-toggle" onClick={() => setShowChanges(!showChanges)}>
        {proposal.changes.length} change{proposal.changes.length === 1 ? "" : "s"}
        <span>{showChanges ? "hide" : "review"}</span>
      </button>
      {showChanges ? (
        <ul className="ds-change-list">
          {proposal.changes.map((change, index) => (
            <li key={`${proposal.id}-${index}`}>
              <ChangeSummary change={change} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="ds-proposal-foot">
        <span className="ds-evidence">
          <IconClock size={12} stroke={1.8} />
          {replications ? `${replications} services` : "simulated"} · run {proposal.runId?.slice(-6)}
        </span>
        <div className="ds-proposal-actions">
          <button
            type="button"
            className="ds-ghost-button"
            onClick={() => act("reject")}
            disabled={acting !== null}
          >
            <IconX size={13} /> {acting === "reject" ? "Rejecting" : "Reject"}
          </button>
          <button
            type="button"
            className="ds-apply-button"
            onClick={() => act("apply")}
            disabled={acting !== null}
          >
            <IconCheck size={13} /> {acting === "apply" ? "Applying" : "Apply to floor"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ChangeSummary({ change }: { change: Proposal["changes"][number] }) {
  const { workspace } = useWorkspace();
  if (change.kind === "table") {
    const table = workspace?.tables.find((candidate) => candidate.id === change.tableId);
    return (
      <span>
        <strong>{table?.label ?? change.tableId}</strong>{" "}
        {change.active === false
          ? "taken offline"
          : change.active === true
            ? "activated"
            : change.seats !== undefined
              ? `seats → ${change.seats}`
              : change.x !== undefined || change.y !== undefined
                ? "moved on the floor"
                : change.sectionId !== undefined
                  ? `moved to ${sectionStyle(change.sectionId).label}`
                  : "updated"}
      </span>
    );
  }
  if (change.kind === "staff") {
    const member = workspace?.staff.find((candidate) => candidate.id === change.staffId);
    return (
      <span>
        <strong>{member?.name ?? change.staffId}</strong>{" "}
        {change.active === false
          ? "called out"
          : change.shiftStart && change.shiftEnd
            ? `shift → ${change.shiftStart}–${change.shiftEnd}`
            : change.maxTables !== undefined
              ? `table cap → ${change.maxTables}`
              : change.sectionId !== undefined
                ? `section → ${sectionStyle(change.sectionId).label}`
                : "roster updated"}
      </span>
    );
  }
  if (change.kind === "add-staff") {
    return (
      <span>
        <strong>Add {change.name}</strong> · {change.role} · {change.shiftStart}–{change.shiftEnd}
      </span>
    );
  }
  const item = workspace?.menu.find((candidate) => candidate.id === change.itemId);
  return (
    <span>
      <strong>{item?.name ?? change.itemId}</strong>{" "}
      {change.active === false ? "off the menu" : change.station ? `→ ${change.station}` : "retimed"}
    </span>
  );
}

function ProposalsTab() {
  const { workspace } = useWorkspace();
  const proposals = workspace?.proposals ?? [];
  const staged = proposals.filter((proposal) => proposal.status === "staged");
  const history = proposals.filter((proposal) => proposal.status !== "staged").slice(0, 4);

  return (
    <div className="ds-dock-scroll">
      <div className="ds-dock-intro">
        <div className="ds-dock-intro-icon">
          <IconLayoutList size={18} stroke={1.7} />
        </div>
        <div>
          <h3>Human approval gate</h3>
          <p>The agent can simulate and stage. A person applies the change to the live floor.</p>
        </div>
      </div>

      {staged.length === 0 ? (
        <DockEmpty
          icon={IconClipboardCheck}
          title="No proposals waiting"
          body="Ask the agent to test a fix like adding a server or moving the pass. It will simulate the change and stage the result here."
          action={
            <button type="button" className="ds-accent-button" onClick={() => focusAgentChat()}>
              Ask the agent
            </button>
          }
        />
      ) : (
        <div className="ds-proposal-list">
          {staged.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}

      {history.length > 0 ? (
        <div className="ds-card-block">
          <div className="ds-block-head">
            <span className="ds-mini-label">Resolved</span>
            <span className="ds-block-note">last {history.length}</span>
          </div>
          <div className="ds-history-list">
            {history.map((proposal) => (
              <div className="ds-history-row" key={proposal.id}>
                <span className="ds-history-status" data-status={proposal.status}>
                  {proposal.status}
                </span>
                <span className="ds-history-title">{proposal.title}</span>
                <span className="ds-history-age">{runAge(proposal.resolvedAt ?? proposal.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StaffTab() {
  const { workspace, selectedScenario, run } = useWorkspace();
  const staff = workspace?.staff ?? [];
  const callouts = new Set(selectedScenario?.callouts ?? []);
  const start = 14 * 60;
  const end = 24 * 60;
  const metrics = run?.metrics ?? selectedScenario?.latestRun?.metrics;

  return (
    <div className="ds-dock-scroll">
      <div className="ds-card-block ds-team-summary">
        <div>
          <span className="ds-mini-label">Team on the floor</span>
          <strong>
            {staff.filter((member) => member.active && !callouts.has(member.id)).length} active
          </strong>
        </div>
        <div>
          <span className="ds-mini-label">Labor</span>
          <strong>{money(metrics?.laborCost, true)}</strong>
        </div>
        <div>
          <span className="ds-mini-label">Covers / server hr</span>
          <strong>{metrics?.coversPerServerHour?.toFixed(1) ?? "—"}</strong>
        </div>
      </div>

      <div className="ds-card-block">
        <div className="ds-block-head">
          <span className="ds-mini-label">Shifts</span>
          <span className="ds-block-note">2 PM → midnight</span>
        </div>
        <div className="ds-shift-scale">
          <span>2 PM</span>
          <span>6 PM</span>
          <span>10 PM</span>
        </div>
        <div className="ds-shift-list">
          {staff.map((member) => {
            const out = callouts.has(member.id) || !member.active;
            const shiftStart = toMinutes(member.shiftStart);
            const shiftEnd = toMinutes(member.shiftEnd);
            const left = ((shiftStart - start) / (end - start)) * 100;
            const width = Math.max(3, ((shiftEnd - shiftStart) / (end - start)) * 100);
            return (
              <div className="ds-shift-row" key={member.id} data-out={out ? "true" : "false"}>
                <div className="ds-shift-name">
                  <span className={`ds-role-dot ds-role-${member.role}`} />
                  <div>
                    <strong>{member.name}</strong>
                    <span>
                      {member.role}
                      {member.station ? ` · ${member.station}` : ""}
                      {member.sectionId ? ` · ${sectionStyle(member.sectionId).label}` : ""}
                    </span>
                  </div>
                  {out ? <em className="ds-callout-chip">out</em> : null}
                </div>
                <div className="ds-shift-track">
                  <span
                    className="ds-shift-bar"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: out ? "rgba(255,255,255,0.1)" : sectionStyle(member.sectionId).color,
                    }}
                  >
                    {!out ? `${member.shiftStart}–${member.shiftEnd}` : "callout"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ds-card-block">
        <div className="ds-block-head">
          <span className="ds-mini-label">Kitchen roster</span>
          <span className="ds-block-note">station coverage</span>
        </div>
        <div className="ds-kitchen-grid">
          {["grill", "saute", "fry", "cold"].map((station) => {
            const cooks = staff.filter(
              (member) => member.station === station && member.active && !callouts.has(member.id),
            );
            return (
              <div className="ds-kitchen-cell" key={station}>
                <IconChefHat size={15} stroke={1.6} />
                <span>{station}</span>
                <strong>{cooks.length > 0 ? cooks.map((cook) => cook.name.split(" ")[0]).join(", ") : "uncovered"}</strong>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ds-card-block">
        <div className="ds-block-head">
          <span className="ds-mini-label">Menu pressure</span>
          <span className="ds-block-note">longest cook</span>
        </div>
        <div className="ds-menu-list">
          {[...(workspace?.menu ?? [])]
            .filter((item) => item.active)
            .sort((a, b) => b.prepMinutes + b.cookMinutes - (a.prepMinutes + a.cookMinutes))
            .slice(0, 5)
            .map((item) => (
              <div className="ds-menu-row" key={item.id}>
                <span>{item.name}</span>
                <span className="ds-menu-station">{item.station}</span>
                <strong>{Math.round(item.prepMinutes + item.cookMinutes)}m</strong>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function toMinutes(value: string): number {
  const [hours = 0, minutesPart = 0] = value.split(":").map(Number);
  return hours * 60 + (minutesPart || 0);
}

function DockEmpty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof IconClipboardCheck;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ds-dock-empty">
      <div className="ds-dock-empty-icon">
        <Icon size={22} stroke={1.6} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ServiceDock() {
  const { dockTab, setDockTab, workspace } = useWorkspace();
  const stagedCount = workspace?.proposals.filter((proposal) => proposal.status === "staged").length ?? 0;

  return (
    <aside className="ds-panel ds-dock">
      <div className="ds-dock-tabs" role="tablist" aria-label="Service detail">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={dockTab === tab.id}
              className="ds-dock-tab"
              data-active={dockTab === tab.id ? "true" : "false"}
              onClick={() => setDockTab(tab.id)}
            >
              <Icon size={15} stroke={1.8} />
              {tab.label}
              {tab.id === "proposals" && stagedCount > 0 ? <span className="ds-tab-count">{stagedCount}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="ds-dock-body">
        {dockTab === "timeline" ? <TimelineTab /> : null}
        {dockTab === "proposals" ? <ProposalsTab /> : null}
        {dockTab === "staff" ? <StaffTab /> : null}
      </div>
    </aside>
  );
}
