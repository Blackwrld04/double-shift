import { IconClock, IconCurrencyDollar, IconFlame, IconUsers } from "@tabler/icons-react";

import { deltaLabel, metricOf, minutes, money, percent } from "./format";
import { useWorkspace } from "./workspace-context";

function Delta({ text, tone }: { text: string; tone: "good" | "bad" | "neutral" }) {
  return (
    <span className="ds-delta" data-tone={tone}>
      {text}
    </span>
  );
}

export function KpiStrip() {
  const { run, selectedScenario, baselineMetrics, runningScenarioId } = useWorkspace();
  const metrics = run?.metrics ?? selectedScenario?.latestRun?.metrics;
  const loading = !metrics && Boolean(runningScenarioId);
  const isBaseline = selectedScenario?.status === "baseline";

  const kpis = [
    {
      key: "covers",
      label: "Covers seated",
      value: loading ? "—" : `${Math.round(metricOf(metrics, "coversSeated"))}`,
      suffix: `of ${Math.round(metricOf(metrics, "coversRequested"))}`,
      icon: IconUsers,
      delta: deltaLabel(
        metricOf(metrics, "coversSeated"),
        metricOf(baselineMetrics, "coversSeated"),
        "count",
      ),
    },
    {
      key: "wait",
      label: "P95 wait",
      value: loading ? "—" : minutes(metricOf(metrics, "p95Wait")),
      suffix: "host quote",
      icon: IconClock,
      delta: deltaLabel(
        metricOf(metrics, "p95Wait"),
        metricOf(baselineMetrics, "p95Wait"),
        "minutes",
      ),
    },
    {
      key: "walkouts",
      label: "Walkouts",
      value: loading ? "—" : `${Math.round(metricOf(metrics, "walkouts"))}`,
      suffix: `${Math.round(metricOf(metrics, "coversWalked"))} covers lost`,
      icon: IconFlame,
      delta: deltaLabel(
        metricOf(metrics, "walkouts"),
        metricOf(baselineMetrics, "walkouts"),
        "count",
      ),
    },
    {
      key: "net",
      label: "Net contribution",
      value: loading ? "—" : money(metricOf(metrics, "net"), true),
      suffix: "after labor",
      icon: IconCurrencyDollar,
      delta: deltaLabel(
        metricOf(metrics, "net"),
        metricOf(baselineMetrics, "net"),
        "money",
      ),
    },
    {
      key: "kitchen",
      label: "Kitchen P95",
      value: loading ? "—" : minutes(metricOf(metrics, "kitchenP95")),
      suffix: "order to pass",
      icon: IconFlame,
      delta: deltaLabel(
        metricOf(metrics, "kitchenP95"),
        metricOf(baselineMetrics, "kitchenP95"),
        "minutes",
      ),
    },
    {
      key: "turns",
      label: "Table turns",
      value: loading ? "—" : metricOf(metrics, "tableTurns").toFixed(1),
      suffix: `${percent(metricOf(metrics, "utilization"))} utilization`,
      icon: IconClock,
      delta: deltaLabel(
        metricOf(metrics, "tableTurns"),
        metricOf(baselineMetrics, "tableTurns"),
        "ratio",
      ),
    },
  ];

  return (
    <div className="ds-kpi-strip" aria-label="Service metrics">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div className="ds-kpi" key={kpi.key}>
            <div className="ds-kpi-head">
              <span className="ds-kpi-label">{kpi.label}</span>
              <Icon className="ds-kpi-icon" size={14} stroke={1.6} />
            </div>
            <div className="ds-kpi-value">{kpi.value}</div>
            <div className="ds-kpi-foot">
              <span className="ds-kpi-suffix">{kpi.suffix}</span>
              {!isBaseline && metrics ? <Delta {...kpi.delta} /> : null}
              {isBaseline && kpi.key === "covers" ? (
                <span className="ds-baseline-tag">baseline</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
