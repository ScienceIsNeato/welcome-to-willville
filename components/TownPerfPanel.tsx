"use client";

import type {
  TownPerfBaselineComparison,
  TownPerfDomSnapshot,
  TownPerfFps,
  TownPerfMemorySummary,
  TownPerfReport,
  TownPerfReportBlock,
  TownPerfReportStep,
} from "@/hooks/useTownInteractionProfiler";

type Props = {
  report: TownPerfReport | null;
  running: boolean;
  panelOpacity: number;
  onRun: () => void;
  onClear: () => void;
  onDownload: () => void;
  onSaveBaseline: () => void;
  onClearBaseline: () => void;
};

type TimingTreeNode = {
  id: string;
  label: string;
  ms: number;
  pct: number;
  depth: number;
  startedAtMs: number;
  fps?: TownPerfFps;
  domSnapshot?: TownPerfDomSnapshot;
  children: TimingTreeNode[];
};

export function TownPerfPanel({
  report,
  running,
  panelOpacity,
  onRun,
  onClear,
  onDownload,
  onSaveBaseline,
  onClearBaseline,
}: Props) {
  const slowestBlocks = report
    ? [...report.blocks].sort((left, right) => right.ms - left.ms).slice(0, 16)
    : [];
  const timingTree = report ? buildTimingTree(report) : [];
  const largestBlockMs = report?.largestBlock?.ms ?? 0;
  const largestBlockOverTarget = largestBlockMs > 500;

  return (
    <aside
      data-town-control
      aria-label="Town interaction performance report"
      style={{
        position: "fixed",
        top: "10dvh",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2200,
        width: "min(860px, calc(100vw - 28px))",
        maxHeight: "calc(90dvh - 14px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: 0,
        borderRadius: 10,
        border: "1px solid rgba(230, 198, 106, 0.35)",
        background: "rgba(12, 8, 5, 0.92)",
        color: "var(--willville-paper)",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
        fontFamily: "var(--font-geist-mono), monospace",
        opacity: panelOpacity,
        pointerEvents: "auto",
      }}
    >
      <div style={panelHeaderStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                opacity: 0.78,
              }}
            >
              Official Perf Test
            </div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700 }}>
              User Journey Replay
            </div>
          </div>

          <button
            type="button"
            onClick={onRun}
            disabled={running}
            style={primaryButtonStyle}
          >
            {running ? "Running..." : "Run"}
          </button>
        </div>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            lineHeight: 1.45,
            opacity: 0.82,
          }}
        >
          Replays a fuller user flow through the live UI: double-click region
          zooms, site clicks, wheel zoom out, drag pan, region label click, Time
          Central shortcut navigation, zoom to the test cap, pan, then full zoom
          out.
        </p>
      </div>

      <div style={panelBodyStyle}>
        {report ? (
          <>
            <div style={summaryBoxStyle}>
              <div style={summaryLabelStyle}>Total Scenario Time</div>
              <div style={summaryValueStyle}>{report.totalMs.toFixed(1)}ms</div>
            </div>

            <div
              style={{
                ...summaryBoxStyle,
                borderColor: largestBlockOverTarget
                  ? "rgba(255, 133, 92, 0.5)"
                  : "rgba(124, 210, 151, 0.45)",
              }}
            >
              <div style={summaryLabelStyle}>Largest Detailed Block</div>
              <div style={summaryValueStyle}>
                {report.largestBlock
                  ? `${report.largestBlock.ms.toFixed(1)}ms`
                  : "n/a"}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  lineHeight: 1.35,
                  opacity: 0.82,
                }}
              >
                {report.largestBlock
                  ? report.largestBlock.label
                  : "No detailed blocks recorded."}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: largestBlockOverTarget ? "#ffb096" : "#9fe0b4",
                }}
              >
                Target: every detailed block under 500ms
              </div>
            </div>

            <FpsSummaryBox fps={report.fps} />

            {report.memory && <MemorySummaryBox memory={report.memory} />}

            {report.baselineComparison && (
              <BaselineComparisonBox
                comparison={report.baselineComparison}
                steps={report.steps}
              />
            )}

            {report.longTasks.length > 0 && (
              <>
                <SectionTitle title="Long Tasks (Main Thread Jank)" />
                <div style={gridStyle}>
                  {report.longTasks.map((task, index) => (
                    <div
                      key={`lt-${index}`}
                      style={{
                        ...rowStyle,
                        color: task.durationMs > 100 ? "#ffb096" : "inherit",
                      }}
                    >
                      <span>at {task.startedAtMs.toFixed(0)}ms</span>
                      <span>{task.durationMs.toFixed(0)}ms</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <SectionTitle title="Waterfall" />
            <WaterfallChart report={report} />

            <SectionTitle title="Timing Tree" />
            <div style={treeStyle}>
              {timingTree.map((node) => (
                <TimingTreeNodeView key={node.id} node={node} />
              ))}
            </div>

            <SectionTitle title="Slowest Detailed Blocks" />
            <div style={gridStyle}>
              {slowestBlocks.map((block) => (
                <div
                  key={`${block.id}-${block.startedAtMs.toFixed(2)}`}
                  style={rowStyle}
                >
                  <span style={{ paddingLeft: block.depth * 10 }}>
                    {block.label}
                  </span>
                  <span>
                    {block.pct.toFixed(1)}% · {block.ms.toFixed(1)}ms
                  </span>
                </div>
              ))}
            </div>

            <SectionTitle title="Method Breakdown" />
            <div style={gridStyle}>
              {report.phases.map((phase) => (
                <div key={phase.key} style={rowStyle}>
                  <span>{phase.label}</span>
                  <span>
                    {phase.pct.toFixed(1)}% · {phase.ms.toFixed(1)}ms
                  </span>
                </div>
              ))}
            </div>

            <SectionTitle title="Phase Samples" />
            <div style={gridStyle}>
              {report.phases.map((phase) => (
                <div key={`${phase.key}-samples`} style={rowStyle}>
                  <span>{phase.label}</span>
                  <span>
                    {phase.samples} × {phase.avgMs.toFixed(2)}ms
                  </span>
                </div>
              ))}
            </div>

            <div style={buttonRowStyle}>
              <button
                type="button"
                onClick={onDownload}
                style={secondaryButtonStyle}
              >
                Download JSON
              </button>
              <button
                type="button"
                onClick={onSaveBaseline}
                style={secondaryButtonStyle}
              >
                Save as Baseline
              </button>
              {report.baselineComparison && (
                <button
                  type="button"
                  onClick={onClearBaseline}
                  style={secondaryButtonStyle}
                >
                  Clear Baseline
                </button>
              )}
              <button
                type="button"
                onClick={onClear}
                style={secondaryButtonStyle}
              >
                Clear
              </button>
            </div>
          </>
        ) : (
          <div style={emptyBoxStyle}>
            {running
              ? "Profiling in progress..."
              : "Run the scenario to generate a repeatable timing report."}
          </div>
        )}
      </div>
    </aside>
  );
}

function formatDelta(ms: number, pct: number): string {
  const sign = ms > 0 ? "+" : "";
  return `${sign}${ms.toFixed(0)}ms (${sign}${pct.toFixed(1)}%)`;
}

function deltaColor(deltaMs: number): string {
  if (deltaMs > 50) return "#ffb096"; // slower = bad
  if (deltaMs < -50) return "#9fe0b4"; // faster = good
  return "inherit";
}

function formatSignedInt(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

type BaselineMetric = { label: string; value: string; good: boolean | null };

function goodness(
  delta: number,
  better: "lower" | "higher",
  threshold = 0,
): boolean | null {
  if (better === "lower")
    return delta < -threshold ? true : delta > threshold ? false : null;
  return delta > threshold ? true : delta < -threshold ? false : null;
}

function buildBaselineMetrics(c: TownPerfBaselineComparison): BaselineMetric[] {
  const m: BaselineMetric[] = [
    {
      label: "Total time",
      value: formatDelta(c.deltaTotalMs, c.deltaTotalPct),
      good: goodness(c.deltaTotalMs, "lower", 20),
    },
    {
      label: "Avg FPS",
      value: `${formatSignedInt(c.deltaAvgFps)} fps`,
      good: goodness(c.deltaAvgFps, "higher", 2),
    },
    {
      label: "Min FPS",
      value: `${formatSignedInt(c.deltaMinFps)} fps`,
      good: goodness(c.deltaMinFps, "higher", 2),
    },
    {
      label: "Dropped frames",
      value: formatSignedInt(c.deltaDroppedFrames),
      good: goodness(c.deltaDroppedFrames, "lower"),
    },
    {
      label: "Long frames",
      value: formatSignedInt(c.deltaLongFrames),
      good: goodness(c.deltaLongFrames, "lower"),
    },
    {
      label: "Long tasks",
      value: formatSignedInt(c.deltaLongTasks),
      good: goodness(c.deltaLongTasks, "lower"),
    },
  ];
  if (c.deltaHeapGrowth !== null) {
    m.push({
      label: "Heap end",
      value: `${c.deltaHeapGrowth > 0 ? "+" : ""}${formatBytes(c.deltaHeapGrowth)}`,
      good: goodness(c.deltaHeapGrowth, "lower", 1024 * 1024),
    });
  }
  return m;
}

function BaselineComparisonBox({
  comparison,
  steps,
}: {
  comparison: TownPerfBaselineComparison;
  steps: TownPerfReportStep[];
}) {
  const isFaster = comparison.deltaTotalMs < 0;
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const significantDeltas = comparison.stepDeltas.filter(
    (d) => Math.abs(d.deltaMs) > 20,
  );
  const metrics = buildBaselineMetrics(comparison);

  return (
    <div
      style={{
        ...summaryBoxStyle,
        borderColor: isFaster
          ? "rgba(124, 210, 151, 0.45)"
          : "rgba(255, 133, 92, 0.5)",
      }}
    >
      <div style={summaryLabelStyle}>
        vs. Baseline ({new Date(comparison.baselineSavedAt).toLocaleString()})
      </div>

      <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              ...rowStyle,
              color:
                m.good === true
                  ? "#9fe0b4"
                  : m.good === false
                    ? "#ffb096"
                    : "inherit",
            }}
          >
            <span>{m.label}</span>
            <span>{m.value}</span>
          </div>
        ))}
      </div>

      {significantDeltas.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              opacity: 0.7,
              marginBottom: 4,
            }}
          >
            Per-step timing
          </div>
          <div style={gridStyle}>
            {significantDeltas.map((d) => {
              const step = stepMap.get(d.stepId);
              return (
                <div
                  key={d.stepId}
                  style={{
                    ...rowStyle,
                    color: deltaColor(d.deltaMs),
                  }}
                >
                  <span>
                    {step?.label ?? d.stepId}
                    {d.deltaFpsAvg !== null && (
                      <span
                        style={{ opacity: 0.7, fontSize: 10, marginLeft: 4 }}
                      >
                        {formatSignedInt(d.deltaFpsAvg)}fps
                      </span>
                    )}
                  </span>
                  <span>{formatDelta(d.deltaMs, d.deltaPct)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const STEP_COLORS = [
  "rgba(230, 198, 106, 0.7)",
  "rgba(106, 198, 230, 0.7)",
  "rgba(180, 140, 230, 0.7)",
  "rgba(140, 230, 160, 0.7)",
  "rgba(230, 140, 140, 0.7)",
  "rgba(230, 180, 106, 0.7)",
  "rgba(106, 230, 210, 0.7)",
  "rgba(200, 200, 120, 0.7)",
  "rgba(160, 160, 230, 0.7)",
  "rgba(230, 160, 200, 0.7)",
];

function WaterfallChart({ report }: { report: TownPerfReport }) {
  const totalMs = Math.max(report.totalMs, 0.001);
  const steps = report.steps;
  if (steps.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 3 }}>
      {/* Time axis */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "90px 1fr",
          gap: 6,
          fontSize: 9,
          opacity: 0.5,
          marginBottom: 2,
        }}
      >
        <span />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>0ms</span>
          <span>{(totalMs / 2).toFixed(0)}ms</span>
          <span>{totalMs.toFixed(0)}ms</span>
        </div>
      </div>
      {steps.map((step, index) => {
        const leftPct = (step.startedAtMs / totalMs) * 100;
        const widthPct = Math.max((step.ms / totalMs) * 100, 0.5);
        const color = STEP_COLORS[index % STEP_COLORS.length];
        return (
          <div
            key={step.id}
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                opacity: 0.82,
              }}
              title={step.label}
            >
              {step.label}
            </span>
            <div
              style={{
                position: "relative",
                height: 14,
                background: "rgba(255, 255, 255, 0.04)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: "100%",
                  background: color,
                  borderRadius: 2,
                  minWidth: 2,
                }}
                title={`${step.ms.toFixed(1)}ms at ${step.startedAtMs.toFixed(0)}ms`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function MemorySummaryBox({ memory }: { memory: TownPerfMemorySummary }) {
  const grew = memory.growthBytes > 0;
  const significantGrowth = memory.growthPct > 10;
  return (
    <div
      style={{
        ...summaryBoxStyle,
        borderColor: significantGrowth
          ? "rgba(255, 133, 92, 0.5)"
          : "rgba(124, 210, 151, 0.45)",
      }}
    >
      <div style={summaryLabelStyle}>JS Heap</div>
      <div style={summaryValueStyle}>{formatBytes(memory.endHeap)}</div>
      <div
        style={{
          marginTop: 6,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          fontSize: 11,
          opacity: 0.82,
        }}
      >
        <span>start {formatBytes(memory.startHeap)}</span>
        <span>peak {formatBytes(memory.peakHeap)}</span>
        <span
          style={{
            color: significantGrowth ? "#ffb096" : grew ? "#ffe27d" : "#9fe0b4",
          }}
        >
          {grew ? "+" : ""}
          {formatBytes(memory.growthBytes)} ({memory.growthPct.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

function FpsSummaryBox({ fps }: { fps: TownPerfFps }) {
  const isLow = fps.avgFps > 0 && fps.avgFps < 30;
  const hasDrops = fps.droppedFrames > 0;
  return (
    <div
      style={{
        ...summaryBoxStyle,
        borderColor: isLow
          ? "rgba(255, 133, 92, 0.5)"
          : "rgba(124, 210, 151, 0.45)",
      }}
    >
      <div style={summaryLabelStyle}>Frame Rate</div>
      <div style={summaryValueStyle}>
        {fps.frameCount > 0 ? `${fps.avgFps} fps` : "n/a"}
      </div>
      {fps.frameCount > 0 && (
        <div
          style={{
            marginTop: 6,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            fontSize: 11,
            opacity: 0.82,
          }}
        >
          <span>min {fps.minFps}</span>
          <span>max {fps.maxFps}</span>
          <span>{fps.frameCount} frames</span>
        </div>
      )}
      {(hasDrops || fps.longFrames > 0) && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: hasDrops ? "#ffb096" : "#ffe27d",
          }}
        >
          {fps.droppedFrames > 0 && (
            <span>{fps.droppedFrames} dropped (&lt;20fps) · </span>
          )}
          {fps.longFrames > 0 && <span>{fps.longFrames} long (&lt;30fps)</span>}
        </div>
      )}
    </div>
  );
}

function TimingTreeNodeView({ node }: { node: TimingTreeNode }) {
  const overTarget = node.ms > 500;
  const fps = node.fps;
  const fpsLow = fps && fps.avgFps > 0 && fps.avgFps < 30;
  const dom = node.domSnapshot;
  return (
    <div style={treeNodeStyle}>
      <div
        style={{
          ...treeRowStyle,
          borderLeftColor:
            node.depth === 0
              ? "rgba(230, 198, 106, 0.45)"
              : "rgba(230, 198, 106, 0.2)",
          color: overTarget ? "#ffb096" : "inherit",
        }}
      >
        <span style={treeLabelStyle}>
          {node.label}
          {fps && fps.frameCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                opacity: 0.7,
                color: fpsLow ? "#ffb096" : "inherit",
              }}
            >
              {fps.avgFps}fps
              {fps.droppedFrames > 0 && ` (${fps.droppedFrames} dropped)`}
            </span>
          )}
          {dom && (
            <span
              style={{
                display: "block",
                fontSize: 9,
                opacity: 0.5,
                marginTop: 1,
              }}
            >
              {dom.totalNodes} DOM · {dom.svgElements} SVG · {dom.stopMarkers}{" "}
              markers
            </span>
          )}
        </span>
        <span style={treeValueStyle}>
          {node.ms.toFixed(1)}ms · {node.pct.toFixed(1)}%
        </span>
      </div>
      {node.children.length > 0 ? (
        <div style={treeChildrenStyle}>
          {node.children.map((child) => (
            <TimingTreeNodeView key={child.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildTimingTree(report: TownPerfReport): TimingTreeNode[] {
  return report.steps.map((step) => ({
    ...stepToNode(step),
    children: buildBlockTree(blocksForStep(step, report.blocks)),
  }));
}

function stepToNode(step: TownPerfReportStep): TimingTreeNode {
  return {
    id: `step-${step.id}`,
    label: step.label,
    ms: step.ms,
    pct: step.pct,
    depth: 0,
    startedAtMs: step.startedAtMs,
    fps: step.fps,
    domSnapshot: step.domSnapshot,
    children: [],
  };
}

function blocksForStep(
  step: TownPerfReportStep,
  blocks: TownPerfReportBlock[],
): TownPerfReportBlock[] {
  const stepEndMs = step.startedAtMs + step.ms;
  return blocks
    .filter(
      (block) =>
        block.startedAtMs >= step.startedAtMs && block.startedAtMs <= stepEndMs,
    )
    .sort((left, right) => left.startedAtMs - right.startedAtMs);
}

function buildBlockTree(blocks: TownPerfReportBlock[]): TimingTreeNode[] {
  const roots: TimingTreeNode[] = [];
  const stack: TimingTreeNode[] = [];

  for (const block of blocks) {
    const node: TimingTreeNode = {
      id: `block-${block.id}-${block.startedAtMs.toFixed(3)}`,
      label: block.label,
      ms: block.ms,
      pct: block.pct,
      depth: block.depth + 1,
      startedAtMs: block.startedAtMs,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  }

  return roots;
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 6,
        fontSize: 11,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        opacity: 0.76,
      }}
    >
      {title}
    </div>
  );
}

const summaryBoxStyle = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 8,
  background: "rgba(34, 22, 10, 0.9)",
  border: "1px solid rgba(230, 198, 106, 0.25)",
};

const panelHeaderStyle = {
  flex: "0 0 auto",
  padding: 14,
  borderBottom: "1px solid rgba(230, 198, 106, 0.18)",
};

const panelBodyStyle = {
  minHeight: 0,
  overflowY: "auto" as const,
  padding: "0 14px 14px",
};

const summaryLabelStyle = {
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: "uppercase" as const,
  opacity: 0.76,
};

const summaryValueStyle = {
  marginTop: 6,
  fontSize: 24,
  fontWeight: 700,
};

const gridStyle = {
  display: "grid",
  gap: 6,
};

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  fontSize: 12,
  lineHeight: 1.35,
};

const treeStyle = {
  display: "grid",
  gap: 4,
};

const treeNodeStyle = {
  display: "grid",
  gap: 4,
};

const treeRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "baseline",
  padding: "5px 0 5px 8px",
  borderLeft: "1px solid rgba(230, 198, 106, 0.2)",
  fontSize: 12,
  lineHeight: 1.3,
};

const treeLabelStyle = {
  minWidth: 0,
  overflowWrap: "anywhere" as const,
};

const treeValueStyle = {
  whiteSpace: "nowrap" as const,
  opacity: 0.84,
};

const treeChildrenStyle = {
  display: "grid",
  gap: 4,
  marginLeft: 12,
};

const buttonRowStyle = {
  display: "flex",
  gap: 8,
  marginTop: 12,
};

const primaryButtonStyle = {
  border: "1px solid rgba(230, 198, 106, 0.35)",
  borderRadius: 8,
  background: "rgba(230, 198, 106, 0.14)",
  color: "var(--willville-paper)",
  padding: "8px 12px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: "rgba(255, 255, 255, 0.04)",
};

const emptyBoxStyle = {
  marginTop: 12,
  padding: "12px 14px",
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.04)",
  fontSize: 12,
  lineHeight: 1.5,
  opacity: 0.82,
};
