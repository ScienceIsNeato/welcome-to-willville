"use client";

import type { CSSProperties } from "react";
import type { CanalBoat } from "@/lib/canal";
import type { Stop } from "@/lib/town";
import { PanelChromeControls } from "./PanelChromeControls";
import { MobileDetailBoard } from "./MobileDetailBoard";

type Props = {
  stop: Stop;
  boats: CanalBoat[];
  panelOpacity: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleVisibility: () => void;
  onOpacityChange: (opacity: number) => void;
};

export function MobileDetailDrawer({
  stop,
  boats,
  panelOpacity,
  expanded,
  onToggleExpanded,
  onToggleVisibility,
  onOpacityChange,
}: Props) {
  const title = stop.repo?.split("/").at(-1) ?? stop.id;
  const preview =
    stop.status.doing || stop.status.summary || "Pull up for details";

  return (
    <aside
      data-town-control
      aria-label="Willville site detail drawer"
      style={shellStyle(expanded, panelOpacity)}
    >
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? `Collapse details for ${title}`
            : `Expand details for ${title}`
        }
        style={handleButtonStyle}
      >
        <span style={grabberStyle} />
        <span style={titleStyle}>{title}</span>
        <span style={hintStyle}>
          {expanded ? "Hide drawer" : "Pull up for details"}
        </span>
        <span style={previewStyle} title={preview}>
          {preview}
        </span>
      </button>

      {expanded && (
        <>
          <div style={headerStyle}>
            <div style={headerCopyStyle}>
              <span style={eyebrowStyle}>Site details</span>
              <strong style={headerTitleStyle}>{title}</strong>
            </div>

            <PanelChromeControls
              panelLabel="Digital detail panel"
              visible
              opacity={panelOpacity}
              onToggleVisibility={onToggleVisibility}
              onOpacityChange={onOpacityChange}
              popoverDirection="up"
            />
          </div>

          <div style={bodyStyle}>
            <MobileDetailBoard
              stop={stop}
              boats={boats}
              panelOpacity={panelOpacity}
            />
          </div>
        </>
      )}
    </aside>
  );
}

function shellStyle(expanded: boolean, panelOpacity: number): CSSProperties {
  return {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
    zIndex: 24,
    display: "flex",
    flexDirection: "column",
    height: expanded ? "clamp(340px, 72dvh, 620px)" : 112,
    padding: "8px 10px 12px",
    borderRadius: "18px 18px 12px 12px",
    border: `1px solid rgba(230,198,106,${0.28 * panelOpacity})`,
    background:
      "linear-gradient(180deg, rgba(11,8,7,0.94) 0%, rgba(8,7,12,0.98) 100%)",
    boxShadow:
      "0 18px 36px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(230,198,106,0.08)",
    backdropFilter: "blur(12px)",
    overflow: "hidden",
    pointerEvents: "auto",
  };
}

const handleButtonStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 6,
  width: "100%",
  padding: "2px 0 8px",
  border: 0,
  background: "transparent",
  color: "var(--willville-paper)",
  cursor: "pointer",
  textAlign: "center",
};

const grabberStyle: CSSProperties = {
  width: 52,
  height: 5,
  borderRadius: 999,
  background: "rgba(245, 230, 200, 0.38)",
};

const titleStyle: CSSProperties = {
  fontSize: 16,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const hintStyle: CSSProperties = {
  color: "rgba(245, 230, 200, 0.72)",
  fontSize: 11,
  lineHeight: 1,
  textTransform: "uppercase",
  letterSpacing: 0.9,
};

const previewStyle: CSSProperties = {
  maxWidth: "100%",
  color: "rgba(245, 230, 200, 0.78)",
  fontSize: 13,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const headerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "start",
  gap: 10,
  paddingBottom: 10,
};

const headerCopyStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const eyebrowStyle: CSSProperties = {
  color: "rgba(245, 230, 200, 0.62)",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: 0.9,
  textTransform: "uppercase",
};

const headerTitleStyle: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.1,
  color: "var(--willville-paper)",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
  paddingBottom: 4,
};
