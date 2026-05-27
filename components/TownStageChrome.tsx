import type { ReactNode } from "react";
import type { CanalBoat } from "@/lib/canal";
import type { Stop } from "@/lib/town";
import { CentralBoard } from "./CentralBoard";
import { DigitalDetailBoard } from "./DigitalDetailBoard";
import { MobileCentralBoard } from "./MobileCentralBoard";
import { MobileDetailDrawer } from "./MobileDetailDrawer";
import { PanelChromeControls } from "./PanelChromeControls";

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
