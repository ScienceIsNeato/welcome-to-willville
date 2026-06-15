"use client";

import { motion } from "framer-motion";
import { DISTRICTS, TOWN, TOWN_OFFSET, WORLD } from "@/lib/willville";
import type { Stop } from "@/lib/town";
import { DistrictZone } from "./DistrictZone";
import { WorldSubstrate } from "./WorldSubstrate";
import { MainLine } from "./MainLine";
import { Canal } from "./Canal";
import { ChimneySmoke } from "./ChimneySmoke";
import { DynamicWalls } from "./DynamicWalls";
import { GeneratedTownBase } from "./GeneratedTownBase";
import { TownSiteAppearances } from "./TownSiteAppearances";
import { WorldWorkerLayer } from "./WorldWorkerLayer";
import { SpecialTownLandmarks } from "./SpecialTownLandmarks";
import { TownPerfPanel } from "./TownPerfPanel";
import { PanelChromeControls } from "./PanelChromeControls";
import { RepositionPlannerPanel, TownStageChrome } from "./TownStageChrome";
import { HistoryTimelapsePanel } from "./HistoryTimelapsePanel";
import { BellMessengers } from "./BellMessengers";
import { TOWN_ART_FEATHER } from "./townStageUtils";
import { useTownStageState } from "./useTownStageState";

/**
 * Persistent SVG stage with viewport camera (pan/zoom) and center HUD for stops.
 */
export function TownStage({ initialStops }: { initialStops: Stop[] }) {
  const state = useTownStageState({ initialStops });

  const {
    localStops,
    perfEnabled,
    svgRef,
    stageRef,
    cameraGroupRef,
    perfProfiler,
    isDragging,
    cameraTransform,
    markSkipDrag,
    stageHandlers,
    showCentralBoard,
    setShowCentralBoard,
    showDigitalBoard,
    setShowDigitalBoard,
    showAboutPane,
    setShowAboutPane,
    centralBoardOpacity,
    setCentralBoardOpacity,
    digitalBoardOpacity,
    setDigitalBoardOpacity,
    showPerfPanel,
    setShowPerfPanel,
    perfPanelOpacity,
    setPerfPanelOpacity,
    mobileSafeMode,
    prefersFullArt,
    mobileDrawerExpanded,
    setMobileDrawerExpanded,
    populating,
    bellStartedAt,
    bellCompletedAtByStopId,
    bellErrorMessage,
    boardAnnouncement,
    isRepositionMode,
    isHistoryMode,
    setShowHistoryPanel,
    handleExitHistoryMode,
    mayorEditingLocked,
    currentStops,
    bellTownHealthSummary,
    repositionableStops,
    setPlannerStopId,
    effectivePlannerStopId,
    plannerStop,
    handleResetStop,
    handleResetAll,
    handleDistrictChange,
    changedStops,
    placementControlsBusy,
    placementQueueState,
    placementQueueMessage,
    canQueuePlacement,
    queuePlacementLabel,
    handleQueuePlacement,
    handleAcceptPlacement,
    handleRejectPlacement,
    customPrompt,
    setCustomPrompt,
    previewUnderlayHrefs,
    repaintControlsBusy,
    repaintQueueState,
    repaintQueueMessage,
    repaintCliOutput,
    canQueueRepaint,
    queueRepaintLabel,
    canAcceptRepaint,
    canRejectRepaint,
    canCancelRepaint,
    handleQueueRepaint,
    handleAcceptRepaint,
    handleRejectRepaint,
    handleCancelRepaint,
    boats,
    currentPlaybackTime,
    isHistoryPlaying,
    setIsHistoryPlaying,
    historySpeed,
    setHistorySpeed,
    setHistoryCurrentTime,
    effectiveStartStr,
    effectiveEndStr,
    historyBoats,
    handlePopulate,
    handleEasterEgg,
    handleTourism,
    handleAboutPaneOpen,
    runOfficialPerfProfile,
    downloadPerfReport,
    boardStop,
    pathDistrict,
    detailBoardVisible,
    areChromeBoardsHidden,
    openStopHud,
    closeHud,
    enterDistrict,
    handleStageClick,
    handleStageDoubleClick,
    hoveredDistrictId,
    setHoveredDistrictId,
    stopMarkers,
    showWelcomeHint,
    stageControlTop,
    stageControlBottom,
    router,
    canAcceptPlacement,
    canRejectPlacement,
  } = state;

  return (
    <div
      id="willville-stage"
      className={
        [
          mobileSafeMode ? "willville-stage--mobile-safe" : "",
          isDragging ? "willville-stage--interacting" : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
      style={{
        position: "relative",
        display: "grid",
        gridTemplateRows: mobileSafeMode
          ? "minmax(0, 1fr)"
          : showCentralBoard
            ? detailBoardVisible
              ? "auto minmax(0, 1fr) auto"
              : "auto minmax(0, 1fr)"
            : detailBoardVisible
              ? "minmax(0, 1fr) auto"
              : "minmax(0, 1fr)",
        gap: mobileSafeMode
          ? 0
          : showCentralBoard || detailBoardVisible
            ? 10
            : 0,
        backgroundColor: "#063755",
        backgroundImage:
          "linear-gradient(rgba(6, 55, 85, 0.32), rgba(8, 5, 21, 0.42))",
      }}
    >
      <TownStageChrome
        mobileSafeMode={mobileSafeMode}
        currentStops={currentStops}
        boardStop={boardStop}
        pathDistrict={pathDistrict}
        boats={historyBoats}
        announcementRows={boardAnnouncement?.rows}
        announcementLabel={boardAnnouncement?.label}
        showCentralBoard={
          !isRepositionMode && !isHistoryMode && showCentralBoard
        }
        showDigitalBoard={
          !isRepositionMode && !isHistoryMode && showDigitalBoard
        }
        detailBoardVisible={
          !isRepositionMode && !isHistoryMode && detailBoardVisible
        }
        showAboutPane={!isRepositionMode && !isHistoryMode && showAboutPane}
        mobileDrawerExpanded={mobileDrawerExpanded}
        centralBoardOpacity={centralBoardOpacity}
        digitalBoardOpacity={digitalBoardOpacity}
        onSelectStop={openStopHud}
        onToggleCentralBoard={() => {
          setShowCentralBoard((current) => {
            const nextVisible = !current;
            if (!nextVisible) {
              setShowAboutPane(false);
            }
            return nextVisible;
          });
        }}
        onCentralOpacityChange={setCentralBoardOpacity}
        onShowDigitalBoard={() => {
          setShowDigitalBoard(true);
          setMobileDrawerExpanded(true);
        }}
        onHideDigitalBoard={() => {
          setShowDigitalBoard(false);
          setMobileDrawerExpanded(false);
        }}
        onToggleDigitalBoard={() => {
          setShowDigitalBoard((current) => !current);
        }}
        onDigitalOpacityChange={setDigitalBoardOpacity}
        onToggleMobileDrawerExpanded={() => {
          setMobileDrawerExpanded((current) => !current);
        }}
        onCloseAboutPane={() => {
          setShowAboutPane(false);
        }}
      >
        <div
          ref={stageRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            minHeight: 0,
            touchAction: "none",
            cursor: isDragging ? "grabbing" : "default",
            overflow: "hidden",
            backgroundColor: "#063755",
          }}
          onClick={handleStageClick}
          onDoubleClick={handleStageDoubleClick}
          {...stageHandlers}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
            preserveAspectRatio={
              mobileSafeMode || areChromeBoardsHidden
                ? "xMidYMid slice"
                : "xMidYMid meet"
            }
            width="100%"
            height="100%"
            style={{
              pointerEvents: "auto",
              touchAction: "none",
            }}
          >
            <defs>
              <linearGradient id="town-feather-top" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="black" />
                <stop offset="100%" stopColor="white" />
              </linearGradient>
              <linearGradient
                id="town-feather-bottom"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="white" />
                <stop offset="100%" stopColor="black" />
              </linearGradient>
              <linearGradient
                id="town-feather-left"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="black" />
                <stop offset="100%" stopColor="white" />
              </linearGradient>
              <linearGradient
                id="town-feather-right"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="white" />
                <stop offset="100%" stopColor="black" />
              </linearGradient>
              <radialGradient
                id="town-feather-corner-top-left"
                gradientUnits="userSpaceOnUse"
                cx={TOWN_ART_FEATHER}
                cy={TOWN_ART_FEATHER}
                r={TOWN_ART_FEATHER}
              >
                <stop offset="0%" stopColor="white" />
                <stop offset="100%" stopColor="black" />
              </radialGradient>
              <radialGradient
                id="town-feather-corner-top-right"
                gradientUnits="userSpaceOnUse"
                cx={TOWN.width - TOWN_ART_FEATHER}
                cy={TOWN_ART_FEATHER}
                r={TOWN_ART_FEATHER}
              >
                <stop offset="0%" stopColor="white" />
                <stop offset="100%" stopColor="black" />
              </radialGradient>
              <radialGradient
                id="town-feather-corner-bottom-left"
                gradientUnits="userSpaceOnUse"
                cx={TOWN_ART_FEATHER}
                cy={TOWN.height - TOWN_ART_FEATHER}
                r={TOWN_ART_FEATHER}
              >
                <stop offset="0%" stopColor="white" />
                <stop offset="100%" stopColor="black" />
              </radialGradient>
              <radialGradient
                id="town-feather-corner-bottom-right"
                gradientUnits="userSpaceOnUse"
                cx={TOWN.width - TOWN_ART_FEATHER}
                cy={TOWN.height - TOWN_ART_FEATHER}
                r={TOWN_ART_FEATHER}
              >
                <stop offset="0%" stopColor="white" />
                <stop offset="100%" stopColor="black" />
              </radialGradient>
              <mask
                id="town-art-feather-mask"
                maskUnits="userSpaceOnUse"
                maskContentUnits="userSpaceOnUse"
                x={0}
                y={0}
                width={TOWN.width}
                height={TOWN.height}
              >
                <rect width={TOWN.width} height={TOWN.height} fill="black" />
                <rect
                  x={TOWN_ART_FEATHER}
                  y={TOWN_ART_FEATHER}
                  width={TOWN.width - TOWN_ART_FEATHER * 2}
                  height={TOWN.height - TOWN_ART_FEATHER * 2}
                  fill="white"
                />
                <rect
                  x={TOWN_ART_FEATHER}
                  width={TOWN.width - TOWN_ART_FEATHER * 2}
                  height={TOWN_ART_FEATHER}
                  fill="url(#town-feather-top)"
                />
                <rect
                  x={TOWN_ART_FEATHER}
                  y={TOWN.height - TOWN_ART_FEATHER}
                  width={TOWN.width - TOWN_ART_FEATHER * 2}
                  height={TOWN_ART_FEATHER}
                  fill="url(#town-feather-bottom)"
                />
                <rect
                  y={TOWN_ART_FEATHER}
                  width={TOWN_ART_FEATHER}
                  height={TOWN.height - TOWN_ART_FEATHER * 2}
                  fill="url(#town-feather-left)"
                />
                <rect
                  x={TOWN.width - TOWN_ART_FEATHER}
                  y={TOWN_ART_FEATHER}
                  width={TOWN_ART_FEATHER}
                  height={TOWN.height - TOWN_ART_FEATHER * 2}
                  fill="url(#town-feather-right)"
                />
                <rect
                  width={TOWN_ART_FEATHER}
                  height={TOWN_ART_FEATHER}
                  fill="url(#town-feather-corner-top-left)"
                />
                <rect
                  x={TOWN.width - TOWN_ART_FEATHER}
                  width={TOWN_ART_FEATHER}
                  height={TOWN_ART_FEATHER}
                  fill="url(#town-feather-corner-top-right)"
                />
                <rect
                  y={TOWN.height - TOWN_ART_FEATHER}
                  width={TOWN_ART_FEATHER}
                  height={TOWN_ART_FEATHER}
                  fill="url(#town-feather-corner-bottom-left)"
                />
                <rect
                  x={TOWN.width - TOWN_ART_FEATHER}
                  y={TOWN.height - TOWN_ART_FEATHER}
                  width={TOWN_ART_FEATHER}
                  height={TOWN_ART_FEATHER}
                  fill="url(#town-feather-corner-bottom-right)"
                />
              </mask>
            </defs>

            <g ref={cameraGroupRef} transform={cameraTransform.get()}>
              <WorldSubstrate fullResArt={prefersFullArt} />

              <g transform={`translate(${TOWN_OFFSET.x}, ${TOWN_OFFSET.y})`}>
                <GeneratedTownBase fullResArt={prefersFullArt} />
                <TownSiteAppearances
                  stops={currentStops}
                  previewUnderlayHrefs={previewUnderlayHrefs}
                />
                {/* Smoke (blur filter) + dynamic walls (drop-shadow filters)
                    re-rasterize every zoom frame. Skip them on mobile — the
                    backgrounds, workers, train, and canal stay. */}
                {!mobileSafeMode && <ChimneySmoke />}
                {!mobileSafeMode && <DynamicWalls />}
                <Canal
                  boats={historyBoats}
                  layer="base"
                  historyCurrentTime={
                    isHistoryMode ? currentPlaybackTime : undefined
                  }
                />
                {DISTRICTS.map((d) => (
                  <g
                    key={d.id}
                    onMouseEnter={() => setHoveredDistrictId(d.id)}
                    onMouseLeave={() => setHoveredDistrictId(null)}
                  >
                    <DistrictZone
                      district={d}
                      layer="hit"
                      isSelected={pathDistrict === d.id}
                      isHovered={hoveredDistrictId === d.id}
                      onEnterDistrict={enterDistrict}
                    />
                  </g>
                ))}
                <MainLine
                  stops={currentStops}
                  onEngineClick={closeHud}
                  engineLabel="Return to the town overview"
                />
                <Canal
                  boats={historyBoats}
                  layer="traffic"
                  historyCurrentTime={
                    isHistoryMode ? currentPlaybackTime : undefined
                  }
                />
                <WorldWorkerLayer stops={currentStops} />
                {populating !== "idle" && (
                  <BellMessengers
                    stops={currentStops}
                    phase={populating}
                    startedAt={bellStartedAt}
                    completedAtByStopId={bellCompletedAtByStopId}
                  />
                )}
                {stopMarkers}
                {DISTRICTS.map((d) => (
                  <g
                    key={`label-${d.id}`}
                    onMouseEnter={() => setHoveredDistrictId(d.id)}
                    onMouseLeave={() => setHoveredDistrictId(null)}
                  >
                    <DistrictZone
                      district={d}
                      layer="label"
                      isSelected={pathDistrict === d.id}
                      isHovered={hoveredDistrictId === d.id}
                      onEnterDistrict={enterDistrict}
                    />
                  </g>
                ))}
                <SpecialTownLandmarks
                  mobileSafeMode={mobileSafeMode}
                  populating={populating}
                  onBell={() => {
                    markSkipDrag();
                    handlePopulate();
                  }}
                  onEgg={() => {
                    markSkipDrag();
                    handleEasterEgg();
                  }}
                  onTourism={() => {
                    markSkipDrag();
                    handleTourism();
                  }}
                  onAbout={() => {
                    markSkipDrag();
                    handleAboutPaneOpen();
                  }}
                  onHarbormasterClick={() => {
                    markSkipDrag();
                    setShowHistoryPanel(true);
                  }}
                />
              </g>
            </g>
          </svg>

          {populating !== "idle" && (
            <div
              style={{
                position: "absolute",
                top: stageControlTop,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(18,10,6,0.92)",
                border: `1px solid ${
                  populating === "done"
                    ? "rgba(100,200,100,0.5)"
                    : populating === "error"
                      ? "rgba(220,80,80,0.5)"
                      : "rgba(230,198,106,0.4)"
                }`,
                borderRadius: 8,
                padding: "8px 16px",
                color: "var(--willville-paper)",
                fontSize: 13,
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              {populating === "running" && "The Town Bell Sees All"}
              {populating === "done" && bellTownHealthSummary}
              {populating === "error" && bellErrorMessage}
            </div>
          )}

          {showWelcomeHint && !isRepositionMode && (
            <motion.div
              style={{
                position: "absolute",
                bottom: stageControlBottom,
                left: 16,
                color: "var(--willville-paper)",
                opacity: 0.8,
                fontSize: 14,
                letterSpacing: 0.6,
                pointerEvents: "none",
                textShadow: "0 1px 4px rgba(0,0,0,0.6)",
              }}
            >
              Welcome to Willville · scroll to zoom · drag to pan · double-click
              to zoom in
            </motion.div>
          )}

          {perfEnabled && showPerfPanel && (
            <div data-town-control style={{ pointerEvents: "none" }}>
              <TownPerfPanel
                report={perfProfiler.report}
                running={perfProfiler.running}
                panelOpacity={perfPanelOpacity}
                onRun={() => {
                  void runOfficialPerfProfile();
                }}
                onClear={perfProfiler.clearReport}
                onDownload={downloadPerfReport}
                onSaveBaseline={perfProfiler.saveCurrentAsBaseline}
                onClearBaseline={perfProfiler.clearCurrentBaseline}
              />
            </div>
          )}

          {perfEnabled && (
            <div
              data-town-control
              style={{
                position: "fixed",
                top: "10dvh",
                left: 14,
                zIndex: 2300,
              }}
            >
              <PanelChromeControls
                panelLabel="Performance panel"
                visible={showPerfPanel}
                opacity={perfPanelOpacity}
                onToggleVisibility={() => {
                  setShowPerfPanel((current) => !current);
                }}
                onOpacityChange={setPerfPanelOpacity}
              />
            </div>
          )}

          {isRepositionMode && (
            <RepositionPlannerPanel
              effectivePlannerStopId={effectivePlannerStopId}
              repositionableStops={repositionableStops}
              plannerStop={plannerStop}
              onPlannerStopChange={setPlannerStopId}
              onDistrictChange={handleDistrictChange}
              changedStops={changedStops}
              localStops={localStops}
              onResetStop={handleResetStop}
              onQueuePlacement={handleQueuePlacement}
              canQueuePlacement={canQueuePlacement}
              queuePlacementLabel={queuePlacementLabel}
              onAcceptPlacement={handleAcceptPlacement}
              canAcceptPlacement={canAcceptPlacement}
              acceptPlacementLabel="✅ Accept Site Change"
              onRejectPlacement={handleRejectPlacement}
              canRejectPlacement={canRejectPlacement}
              rejectPlacementLabel="↩ Reject Site Change"
              placementControlsBusy={placementControlsBusy}
              placementQueueState={placementQueueState}
              placementQueueMessage={placementQueueMessage}
              onQueueRepaint={handleQueueRepaint}
              canQueueRepaint={canQueueRepaint}
              queueRepaintLabel={queueRepaintLabel}
              onAcceptRepaint={handleAcceptRepaint}
              canAcceptRepaint={canAcceptRepaint}
              acceptRepaintLabel="✅ Accept"
              onRejectRepaint={handleRejectRepaint}
              canRejectRepaint={canRejectRepaint}
              rejectRepaintLabel="↩ Reject"
              onCancelRepaint={handleCancelRepaint}
              canCancelRepaint={canCancelRepaint}
              cancelRepaintLabel="✕ Cancel Run"
              repaintControlsBusy={repaintControlsBusy}
              repaintQueueState={repaintQueueState}
              repaintQueueMessage={repaintQueueMessage}
              repaintCliOutput={repaintCliOutput}
              onResetAll={handleResetAll}
              onExitEditor={() => router.push("/")}
              customPrompt={customPrompt}
              setCustomPrompt={setCustomPrompt}
              editingLocked={mayorEditingLocked}
              editingLockedMessage="Only the mayor can edit Willville. Production mode is read-only."
            />
          )}

          {isHistoryMode && (
            <HistoryTimelapsePanel
              currentTime={currentPlaybackTime}
              isPlaying={isHistoryPlaying}
              speed={historySpeed}
              startDate={effectiveStartStr}
              endDate={effectiveEndStr}
              boats={boats}
              mobileSafeMode={mobileSafeMode}
              onCurrentTimeChange={setHistoryCurrentTime}
              onIsPlayingChange={setIsHistoryPlaying}
              onSpeedChange={setHistorySpeed}
              onExit={handleExitHistoryMode}
            />
          )}
        </div>
      </TownStageChrome>
    </div>
  );
}
