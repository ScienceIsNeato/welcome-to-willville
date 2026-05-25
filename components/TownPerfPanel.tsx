"use client";

import type { TownPerfReport } from "@/hooks/useTownInteractionProfiler";

type Props = {
  report: TownPerfReport | null;
  running: boolean;
  onRun: () => void;
  onClear: () => void;
  onDownload: () => void;
};

export function TownPerfPanel({
  report,
  running,
  onRun,
  onClear,
  onDownload,
}: Props) {
  return (
    <aside
      aria-label="Town interaction performance report"
      style={{
        position: "fixed",
        top: 14,
        right: 14,
        zIndex: 1200,
        width: "min(340px, calc(100vw - 28px))",
        maxHeight: "calc(100vh - 28px)",
        overflowY: "auto",
        padding: 14,
        borderRadius: 10,
        border: "1px solid rgba(230, 198, 106, 0.35)",
        background: "rgba(12, 8, 5, 0.92)",
        color: "var(--willville-paper)",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
        fontFamily: "var(--font-geist-mono), monospace",
      }}
    >
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
          {running ? "Running…" : "Run"}
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

      {report ? (
        <>
          <div style={summaryBoxStyle}>
            <div style={summaryLabelStyle}>Total Scenario Time</div>
            <div style={summaryValueStyle}>{report.totalMs.toFixed(1)}ms</div>
          </div>

          <SectionTitle title="Step Breakdown" />
          <div style={gridStyle}>
            {report.steps.map((step) => (
              <div key={step.id} style={rowStyle}>
                <span>{step.label}</span>
                <span>
                  {step.pct.toFixed(1)}% · {step.ms.toFixed(1)}ms
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
            ? "Profiling in progress…"
            : "Run the scenario to generate a repeatable timing report."}
        </div>
      )}
    </aside>
  );
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
