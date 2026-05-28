import type { ReactNode } from "react";
import type { CanalBoat } from "@/lib/canal";
import type { Stop } from "@/lib/town";
import { DISTRICTS, type DistrictId } from "@/lib/willville";
import { isKnownDistrict } from "@/lib/slugs";
import { CentralBoard } from "./CentralBoard";
import { DigitalDetailBoard } from "./DigitalDetailBoard";
import { MobileCentralBoard } from "./MobileCentralBoard";
import { MobileDetailDrawer } from "./MobileDetailDrawer";
import { PanelChromeControls } from "./PanelChromeControls";
import type { RepositionStopDelta } from "./repositionPlannerUtils";

type Props = {
  children: ReactNode;
  mobileSafeMode: boolean;
  currentStops: Stop[];
  boardStop: Stop | null;
  pathDistrict: string | null;
  boats: CanalBoat[];
  announcementRows?: string[] | null;
  announcementLabel?: string;
  showCentralBoard: boolean;
  showDigitalBoard: boolean;
  detailBoardVisible: boolean;
  mobileDrawerExpanded: boolean;
  centralBoardOpacity: number;
  digitalBoardOpacity: number;
  onSelectStop: (stop: Stop) => void;
  onToggleCentralBoard: () => void;
  onCentralOpacityChange: (opacity: number) => void;
  onShowDigitalBoard: () => void;
  onHideDigitalBoard: () => void;
  onToggleDigitalBoard: () => void;
  onDigitalOpacityChange: (opacity: number) => void;
  onToggleMobileDrawerExpanded: () => void;
};

export function TownStageChrome({
  children,
  mobileSafeMode,
  currentStops,
  boardStop,
  pathDistrict,
  boats,
  announcementRows,
  announcementLabel,
  showCentralBoard,
  showDigitalBoard,
  detailBoardVisible,
  mobileDrawerExpanded,
  centralBoardOpacity,
  digitalBoardOpacity,
  onSelectStop,
  onToggleCentralBoard,
  onCentralOpacityChange,
  onShowDigitalBoard,
  onHideDigitalBoard,
  onToggleDigitalBoard,
  onDigitalOpacityChange,
  onToggleMobileDrawerExpanded,
}: Props) {
  return (
    <>
      {!mobileSafeMode && showCentralBoard && (
        <div
          style={{
            gridRow: "1 / 2",
            position: "relative",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <CentralBoard
            stops={currentStops}
            selectedStop={boardStop}
            activeDistrict={pathDistrict}
            onSelectStop={onSelectStop}
            announcementRows={announcementRows}
            announcementLabel={announcementLabel}
            panelOpacity={centralBoardOpacity}
          />

          <div
            style={{
              position: "absolute",
              top: 10,
              right: 14,
              zIndex: 4,
              pointerEvents: "auto",
            }}
          >
            <PanelChromeControls
              panelLabel="Time Central panel"
              visible={showCentralBoard}
              opacity={centralBoardOpacity}
              onToggleVisibility={onToggleCentralBoard}
              onOpacityChange={onCentralOpacityChange}
            />
          </div>
        </div>
      )}

      {mobileSafeMode && showCentralBoard && (
        <div
          data-town-control
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(calc(100vw - 20px), 460px)",
            zIndex: 14,
            pointerEvents: "auto",
          }}
        >
          <div style={{ position: "relative" }}>
            <MobileCentralBoard
              stops={currentStops}
              selectedStop={boardStop}
              activeDistrict={pathDistrict}
              announcementRows={announcementRows}
              announcementLabel={announcementLabel}
              panelOpacity={centralBoardOpacity}
            />

            <div
              style={{
                position: "absolute",
                top: 8,
                right: 10,
                zIndex: 4,
                pointerEvents: "auto",
              }}
            >
              <PanelChromeControls
                panelLabel="Time Central panel"
                visible={showCentralBoard}
                opacity={centralBoardOpacity}
                onToggleVisibility={onToggleCentralBoard}
                onOpacityChange={onCentralOpacityChange}
              />
            </div>
          </div>
        </div>
      )}

      {children}

      {!showCentralBoard && (
        <div
          style={{
            position: "absolute",
            top: mobileSafeMode ? 12 : 14,
            right: 16,
            zIndex: 20,
          }}
        >
          <PanelChromeControls
            panelLabel="Time Central panel"
            visible={showCentralBoard}
            opacity={centralBoardOpacity}
            onToggleVisibility={onToggleCentralBoard}
            onOpacityChange={onCentralOpacityChange}
          />
        </div>
      )}

      {!mobileSafeMode && detailBoardVisible && (
        <div
          style={{
            gridRow: "3 / 4",
            position: "relative",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <DigitalDetailBoard
            stop={boardStop}
            boats={boats}
            panelOpacity={digitalBoardOpacity}
          />

          <div
            style={{
              position: "absolute",
              top: 10,
              right: 14,
              zIndex: 4,
              pointerEvents: "auto",
            }}
          >
            <PanelChromeControls
              panelLabel="Digital detail panel"
              visible={showDigitalBoard}
              opacity={digitalBoardOpacity}
              onToggleVisibility={onToggleDigitalBoard}
              onOpacityChange={onDigitalOpacityChange}
            />
          </div>
        </div>
      )}

      {mobileSafeMode && detailBoardVisible && boardStop && (
        <MobileDetailDrawer
          stop={boardStop}
          boats={boats}
          panelOpacity={digitalBoardOpacity}
          expanded={mobileDrawerExpanded}
          onToggleExpanded={onToggleMobileDrawerExpanded}
          onToggleVisibility={onHideDigitalBoard}
          onOpacityChange={onDigitalOpacityChange}
        />
      )}

      {!mobileSafeMode && !!boardStop && !detailBoardVisible && (
        <div
          style={{
            position: "absolute",
            right: 16,
            bottom: 62,
            zIndex: 20,
          }}
        >
          <PanelChromeControls
            panelLabel="Digital detail panel"
            visible={showDigitalBoard}
            opacity={digitalBoardOpacity}
            onToggleVisibility={onToggleDigitalBoard}
            onOpacityChange={onDigitalOpacityChange}
            popoverDirection="up"
          />
        </div>
      )}

      {mobileSafeMode && !!boardStop && (
        <div
          style={{
            position: "absolute",
            right: 16,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
            zIndex: 22,
          }}
        >
          <PanelChromeControls
            panelLabel="Digital detail panel"
            visible={showDigitalBoard}
            opacity={digitalBoardOpacity}
            onToggleVisibility={() => {
              if (showDigitalBoard) {
                onHideDigitalBoard();
                return;
              }
              onShowDigitalBoard();
            }}
            onOpacityChange={onDigitalOpacityChange}
            popoverDirection="up"
          />
        </div>
      )}
    </>
  );
}

type RepaintQueueState = "idle" | "running" | "queued" | "error";

type RepositionPlannerPanelProps = {
  effectivePlannerStopId: string;
  repositionableStops: Stop[];
  plannerStop: Stop | null;
  onPlannerStopChange: (stopId: string | null) => void;
  onDistrictChange: (stopId: string, nextDistrict: DistrictId) => void;
  changedStops: Array<[string, RepositionStopDelta]>;
  localStops: Stop[];
  onResetStop: (stopId: string) => void;
  onCopy: () => void;
  copied: boolean;
  onQueueRepaint: () => void;
  repaintQueueState: RepaintQueueState;
  repaintQueueMessage: string;
  onResetAll: () => void;
  onExitEditor: () => void;
};

export function RepositionPlannerPanel({
  effectivePlannerStopId,
  repositionableStops,
  plannerStop,
  onPlannerStopChange,
  onDistrictChange,
  changedStops,
  localStops,
  onResetStop,
  onCopy,
  copied,
  onQueueRepaint,
  repaintQueueState,
  repaintQueueMessage,
  onResetAll,
  onExitEditor,
}: RepositionPlannerPanelProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        width: 340,
        maxHeight: "calc(100vh - 32px)",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(180deg, rgba(28,20,38,0.92) 0%, rgba(15,10,22,0.96) 100%)",
        color: "var(--willville-paper)",
        borderRadius: 12,
        border: "1px solid rgba(230,198,106,0.35)",
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "16px 18px",
        fontFamily: "var(--font-sans), sans-serif",
        zIndex: 2500,
        overflow: "hidden",
        pointerEvents: "auto",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 20 }}>🗺️</span>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "#e6c66a",
            letterSpacing: 0.5,
          }}
        >
          Willville Planner
        </h2>
      </div>

      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          lineHeight: 1.45,
          opacity: 0.85,
        }}
      >
        Select a site here, then drag that specific marker to reposition it live
        on the map. Dragging anywhere else still pans the map normally. Use the
        picker to reassign districts. District changes snap the site to its
        default slot in the new region so you can fine-tune from there.
      </p>

      <div
        style={{
          marginBottom: 16,
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "#e6c66a",
          }}
        >
          Region Picker
        </div>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 12,
          }}
        >
          <span style={{ opacity: 0.8 }}>Site</span>
          <select
            value={effectivePlannerStopId}
            onChange={(event) => onPlannerStopChange(event.target.value)}
            style={{
              background: "rgba(10, 8, 18, 0.88)",
              color: "var(--willville-paper)",
              border: "1px solid rgba(230,198,106,0.25)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
            }}
          >
            {repositionableStops.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.displayName}
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 12,
          }}
        >
          <span style={{ opacity: 0.8 }}>District</span>
          <select
            value={plannerStop?.district ?? ""}
            onChange={(event) => {
              if (!plannerStop || !isKnownDistrict(event.target.value)) {
                return;
              }
              onDistrictChange(plannerStop.id, event.target.value);
            }}
            disabled={!plannerStop}
            style={{
              background: "rgba(10, 8, 18, 0.88)",
              color: "var(--willville-paper)",
              border: "1px solid rgba(230,198,106,0.25)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              opacity: plannerStop ? 1 : 0.6,
            }}
          >
            {DISTRICTS.map((district) => (
              <option key={district.id} value={district.id}>
                {district.displayName}
              </option>
            ))}
          </select>
        </label>
        {plannerStop && (
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.45,
              opacity: 0.72,
            }}
          >
            Current: {plannerStop.displayName} in {plannerStop.district} at (
            {plannerStop.position.x}, {plannerStop.position.y})
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          margin: "0 0 16px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "#e6c66a",
            marginBottom: 8,
          }}
        >
          Modified Sites ({changedStops.length})
        </div>
        {changedStops.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              fontStyle: "italic",
              opacity: 0.6,
              padding: "8px 0",
            }}
          >
            No site changes yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {changedStops.map(([id, item]) => {
              const s = localStops.find((x) => x.id === id);
              if (!s) return null;
              const districtChanged =
                item.original.district !== item.current.district;
              return (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 6,
                    padding: "6px 8px",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.displayName}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "monospace",
                        opacity: 0.7,
                      }}
                    >
                      {districtChanged
                        ? `${item.original.district} ➔ ${item.current.district}`
                        : s.district}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "monospace",
                        opacity: 0.7,
                      }}
                    >
                      ({item.original.x}, {item.original.y}) ➔ ({item.current.x}
                      , {item.current.y})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onResetStop(id)}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "#f4a0a0",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: "2px 6px",
                      borderRadius: 4,
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(244,160,160,0.15)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    Reset
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderTop: "1px solid rgba(230,198,106,0.18)",
          paddingTop: 14,
        }}
      >
        <button
          type="button"
          onClick={onCopy}
          style={{
            width: "100%",
            background: copied
              ? "#7bd389"
              : "linear-gradient(90deg, #b8862c 0%, #e6c66a 100%)",
            border: 0,
            color: "#1a1233",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
            boxShadow: "0 4px 12px rgba(230,198,106,0.25)",
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 6px 16px rgba(230,198,106,0.4)";
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.currentTarget.style.transform = "translateY(0px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(230,198,106,0.25)";
            }
          }}
        >
          {copied ? "✓ Copied!" : "📋 Copy Heuristics Code"}
        </button>

        <button
          type="button"
          onClick={onQueueRepaint}
          disabled={
            changedStops.length === 0 || repaintQueueState === "running"
          }
          style={{
            width: "100%",
            background:
              repaintQueueState === "queued"
                ? "#7bd389"
                : repaintQueueState === "error"
                  ? "#d45757"
                  : "rgba(20, 132, 196, 0.9)",
            border: 0,
            color: "#f6f0da",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            cursor:
              changedStops.length === 0 || repaintQueueState === "running"
                ? "not-allowed"
                : "pointer",
            opacity:
              changedStops.length === 0 || repaintQueueState === "running"
                ? 0.65
                : 1,
            transition: "all 0.2s",
            boxShadow: "0 4px 12px rgba(20,132,196,0.28)",
          }}
        >
          {repaintQueueState === "running"
            ? "⏳ Queueing Repaint Jobs"
            : "🎨 Queue Repaint Jobs"}
        </button>

        {repaintQueueState !== "idle" && repaintQueueMessage && (
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.35,
              opacity: 0.86,
              color: repaintQueueState === "error" ? "#f4a0a0" : "#dbeeff",
            }}
          >
            {repaintQueueMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onResetAll}
            disabled={changedStops.length === 0}
            style={{
              flex: 1,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "var(--willville-paper)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: changedStops.length === 0 ? "not-allowed" : "pointer",
              opacity: changedStops.length === 0 ? 0.5 : 1,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (changedStops.length > 0)
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Reset All
          </button>

          <button
            type="button"
            onClick={onExitEditor}
            style={{
              flex: 1,
              background: "rgba(220,80,80,0.12)",
              border: "1px solid rgba(220,80,80,0.4)",
              color: "#f4a0a0",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(220,80,80,0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(220,80,80,0.12)")
            }
          >
            Exit Editor
          </button>
        </div>
      </div>
    </div>
  );
}
