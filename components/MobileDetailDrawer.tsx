"use client";

import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import type { CanalBoat } from "@/lib/canal";
import type { Stop } from "@/lib/town";
import { PanelChromeControls } from "./PanelChromeControls";
import { MobileDetailBoard } from "./MobileDetailBoard";

const DRAG_THRESHOLD_PX = 46;
const MAX_DRAG_PREVIEW_PX = 160;

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
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [handleDragging, setHandleDragging] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);
  const dragLastYRef = useRef(0);
  const dragMovedRef = useRef(false);
  const suppressNextClickRef = useRef(false);

  const clearDrag = () => {
    activePointerIdRef.current = null;
    dragStartYRef.current = 0;
    dragLastYRef.current = 0;
    dragMovedRef.current = false;
    setHandleDragging(false);
    setDragOffsetY(0);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    activePointerIdRef.current = event.pointerId;
    dragStartYRef.current = event.clientY;
    dragLastYRef.current = event.clientY;
    dragMovedRef.current = false;
    setHandleDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    const deltaY = event.clientY - dragStartYRef.current;
    dragLastYRef.current = event.clientY;

    if (Math.abs(deltaY) > 4) {
      dragMovedRef.current = true;
    }

    const rawOffset = expanded
      ? Math.max(0, deltaY)
      : Math.min(0, Math.max(-MAX_DRAG_PREVIEW_PX, deltaY));
    setDragOffsetY(Math.min(MAX_DRAG_PREVIEW_PX, rawOffset));

    event.preventDefault();
  };

  const finishDrag = () => {
    const deltaY = dragLastYRef.current - dragStartYRef.current;
    const crossedCollapseThreshold = expanded && deltaY >= DRAG_THRESHOLD_PX;
    const crossedExpandThreshold = !expanded && deltaY <= -DRAG_THRESHOLD_PX;

    if (
      dragMovedRef.current &&
      (crossedCollapseThreshold || crossedExpandThreshold)
    ) {
      onToggleExpanded();
    }

    if (dragMovedRef.current) {
      suppressNextClickRef.current = true;
    }

    clearDrag();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }
    finishDrag();
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }
    clearDrag();
  };

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onToggleExpanded();
  };

  const title = stop.repo?.split("/").at(-1) ?? stop.id;
  const preview =
    stop.status.doing || stop.status.summary || "Pull up for details";

  return (
    <aside
      data-town-control
      aria-label="Willville site detail drawer"
      style={shellStyle(expanded, panelOpacity, dragOffsetY, handleDragging)}
    >
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
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

function shellStyle(
  expanded: boolean,
  panelOpacity: number,
  dragOffsetY: number,
  dragging: boolean,
): CSSProperties {
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
      "linear-gradient(180deg, rgba(11,8,7,0.30) 0%, rgba(8,7,12,0.30) 100%)",
    boxShadow:
      "0 18px 36px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(230,198,106,0.08)",
    backdropFilter: "blur(12px)",
    overflow: "hidden",
    pointerEvents: "auto",
    transform: `translateY(${dragOffsetY}px)`,
    transition: dragging
      ? "none"
      : "height 220ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 180ms ease-out",
    willChange: "height, transform",
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
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
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
