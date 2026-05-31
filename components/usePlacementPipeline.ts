"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Stop } from "@/lib/town";
import {
  getBellErrorDetail,
  resolveRepaintRunnerBaseUrl,
} from "./townStageUtils";
import type { RepositionStopDelta } from "./repositionPlannerUtils";
import type { DistrictId } from "@/lib/willville";

type PlacementQueueState = "idle" | "running" | "review" | "error";

type PlacementChange = {
  stopId: string;
  from: {
    x: number;
    y: number;
    district: DistrictId;
  };
  to: {
    x: number;
    y: number;
    district: DistrictId;
  };
};

type PlacementJobRecord = {
  id: string;
  stopId: string;
  repo: string;
  displayName: string;
  status: "awaiting_review";
  createdAt: string;
  change: PlacementChange;
};

type PlacementStatusResponse = {
  activePlacement?: PlacementJobRecord | null;
  acceptedPlacement?: {
    id: string;
    stopId: string;
    displayName: string;
  };
  rejectedPlacement?: {
    id: string;
    stopId: string;
    displayName: string;
  };
  error?: string;
};

type UsePlacementPipelineParams = {
  isClient: boolean;
  isRepositionMode: boolean;
  plannerStop: Stop | null;
  movedStops: Record<string, RepositionStopDelta>;
  onPlacementAccepted: (stopId: string) => void;
  onPlacementRejected: (stopId: string) => void;
};

function hasDelta(item: RepositionStopDelta | undefined): boolean {
  if (!item) {
    return false;
  }

  return (
    item.original.x !== item.current.x ||
    item.original.y !== item.current.y ||
    item.original.district !== item.current.district
  );
}

export function usePlacementPipeline({
  isClient,
  isRepositionMode,
  plannerStop,
  movedStops,
  onPlacementAccepted,
  onPlacementRejected,
}: UsePlacementPipelineParams) {
  const [activePlacement, setActivePlacement] =
    useState<PlacementJobRecord | null>(null);
  const [placementControlsBusy, setPlacementControlsBusy] = useState(false);
  const [placementRunnerAvailable, setPlacementRunnerAvailable] =
    useState(false);
  const [placementQueueState, setPlacementQueueState] =
    useState<PlacementQueueState>("idle");
  const [placementQueueMessage, setPlacementQueueMessage] = useState("");

  const repaintRunnerBaseUrl = useMemo(
    () => (isClient ? resolveRepaintRunnerBaseUrl() : null),
    [isClient],
  );

  const selectedDelta = plannerStop ? movedStops[plannerStop.id] : undefined;
  const hasSelectedDelta = hasDelta(selectedDelta);

  const hasOtherDeltas = useMemo(() => {
    if (!plannerStop) {
      return false;
    }

    return Object.entries(movedStops).some(
      ([stopId, delta]) => stopId !== plannerStop.id && hasDelta(delta),
    );
  }, [movedStops, plannerStop]);

  const syncPlacement = useCallback(
    async ({ silenceErrors = false }: { silenceErrors?: boolean } = {}) => {
      if (!isRepositionMode || !repaintRunnerBaseUrl) {
        setPlacementRunnerAvailable(false);
        setActivePlacement(null);
        setPlacementQueueState("idle");
        if (silenceErrors || !isRepositionMode) {
          setPlacementQueueMessage("");
        } else {
          setPlacementQueueState("error");
          setPlacementQueueMessage(
            "Placement runner is offline. Restart with scripts/deploy_app.sh.",
          );
        }
        return;
      }

      try {
        const response = await fetch(`${repaintRunnerBaseUrl}/status`);
        if (!response.ok) {
          throw new Error(await getBellErrorDetail(response));
        }

        const result = (await response.json()) as PlacementStatusResponse;
        setPlacementRunnerAvailable(true);
        setActivePlacement(result.activePlacement ?? null);
        setPlacementQueueState(result.activePlacement ? "review" : "idle");
        setPlacementQueueMessage("");
      } catch (error: unknown) {
        setPlacementRunnerAvailable(false);
        setActivePlacement(null);
        setPlacementQueueState("idle");
        if (silenceErrors) {
          setPlacementQueueMessage("");
          return;
        }

        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setPlacementQueueState("error");
        setPlacementQueueMessage(`Placement runner refresh failed: ${detail}`);
      }
    },
    [isRepositionMode, repaintRunnerBaseUrl],
  );

  useEffect(() => {
    if (!isRepositionMode || !repaintRunnerBaseUrl) {
      return;
    }

    const initialRefreshId = window.setTimeout(() => {
      void syncPlacement({ silenceErrors: true });
    }, 0);
    const intervalId = window.setInterval(() => {
      void syncPlacement({ silenceErrors: true });
    }, 3000);

    return () => {
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
    };
  }, [isRepositionMode, repaintRunnerBaseUrl, syncPlacement]);

  const queuePlacementLabel = !placementRunnerAvailable
    ? "🚫 Runner Offline"
    : activePlacement
      ? activePlacement.stopId === plannerStop?.id
        ? "🧪 Site Change Ready"
        : "⛔ Another Site Change Staged"
      : !plannerStop
        ? "🗂 Stage Selected Site"
        : !hasSelectedDelta
          ? "🗂 Stage Selected Site"
          : hasOtherDeltas
            ? "⛔ Reset Other Site Changes First"
            : `🗂 Stage ${plannerStop.displayName}`;

  const derivedMessage = !placementRunnerAvailable
    ? "Placement runner is offline. Restart with scripts/deploy_app.sh."
    : activePlacement
      ? activePlacement.stopId === plannerStop?.id
        ? `${activePlacement.displayName} is staged for review. Accept writes lib/willville.heuristics.ts directly. Reject discards this staged site change.`
        : `${activePlacement.displayName} is already staged. Accept or reject it before staging another site.`
      : hasOtherDeltas
        ? "Only one site can be staged at a time. Reset other site edits first."
        : hasSelectedDelta
          ? `${plannerStop?.displayName ?? "Selected site"} has a pending layout change ready to stage.`
          : "Move the selected site (or change district) to stage a placement update.";

  const canQueuePlacement =
    Boolean(plannerStop) &&
    placementRunnerAvailable &&
    !activePlacement &&
    hasSelectedDelta &&
    !hasOtherDeltas;

  const canAcceptPlacement = Boolean(
    placementRunnerAvailable && activePlacement,
  );
  const canRejectPlacement = Boolean(
    placementRunnerAvailable && activePlacement,
  );

  const handleQueuePlacement = useCallback(() => {
    if (
      !plannerStop ||
      !plannerStop.repo ||
      !repaintRunnerBaseUrl ||
      !selectedDelta ||
      !hasDelta(selectedDelta)
    ) {
      return;
    }

    setPlacementControlsBusy(true);
    setPlacementQueueState("running");
    setPlacementQueueMessage(
      `Staging ${plannerStop.displayName} for review...`,
    );

    fetch(`${repaintRunnerBaseUrl}/placement/queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repo: plannerStop.repo,
        displayName: plannerStop.displayName,
        lines: plannerStop.lines,
        change: {
          stopId: plannerStop.id,
          from: {
            x: selectedDelta.original.x,
            y: selectedDelta.original.y,
            district: selectedDelta.original.district,
          },
          to: {
            x: selectedDelta.current.x,
            y: selectedDelta.current.y,
            district: selectedDelta.current.district,
          },
        },
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getBellErrorDetail(response));
        }

        return response.json() as Promise<PlacementStatusResponse>;
      })
      .then((result) => {
        setPlacementRunnerAvailable(true);
        setActivePlacement(result.activePlacement ?? null);
        setPlacementQueueState(result.activePlacement ? "review" : "idle");
        setPlacementQueueMessage(
          `${plannerStop.displayName} staged. Accept writes the heuristics file, reject drops this change.`,
        );
      })
      .catch((error: unknown) => {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setPlacementQueueState("error");
        setPlacementQueueMessage(`Stage request failed: ${detail}`);
      })
      .finally(() => {
        setPlacementControlsBusy(false);
      });
  }, [plannerStop, repaintRunnerBaseUrl, selectedDelta]);

  const handleAcceptPlacement = useCallback(() => {
    if (
      !activePlacement ||
      !repaintRunnerBaseUrl ||
      !placementRunnerAvailable
    ) {
      return;
    }

    setPlacementControlsBusy(true);
    setPlacementQueueState("running");
    setPlacementQueueMessage(`Accepting ${activePlacement.displayName}...`);

    fetch(`${repaintRunnerBaseUrl}/placement/accept`, {
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getBellErrorDetail(response));
        }

        return response.json() as Promise<PlacementStatusResponse>;
      })
      .then((result) => {
        const acceptedStopId = result.acceptedPlacement?.stopId;
        if (acceptedStopId) {
          onPlacementAccepted(acceptedStopId);
        }
        setActivePlacement(result.activePlacement ?? null);
        setPlacementQueueState("idle");
        setPlacementQueueMessage(
          `${result.acceptedPlacement?.displayName ?? activePlacement.displayName} accepted. Updated lib/willville.heuristics.ts for this site.`,
        );
      })
      .catch((error: unknown) => {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setPlacementQueueState("error");
        setPlacementQueueMessage(`Accept failed: ${detail}`);
      })
      .finally(() => {
        setPlacementControlsBusy(false);
      });
  }, [
    activePlacement,
    onPlacementAccepted,
    placementRunnerAvailable,
    repaintRunnerBaseUrl,
  ]);

  const handleRejectPlacement = useCallback(() => {
    if (
      !activePlacement ||
      !repaintRunnerBaseUrl ||
      !placementRunnerAvailable
    ) {
      return;
    }

    setPlacementControlsBusy(true);
    setPlacementQueueState("running");
    setPlacementQueueMessage(`Rejecting ${activePlacement.displayName}...`);

    fetch(`${repaintRunnerBaseUrl}/placement/reject`, {
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getBellErrorDetail(response));
        }

        return response.json() as Promise<PlacementStatusResponse>;
      })
      .then((result) => {
        const rejectedStopId = result.rejectedPlacement?.stopId;
        if (rejectedStopId) {
          onPlacementRejected(rejectedStopId);
        }
        setActivePlacement(result.activePlacement ?? null);
        setPlacementQueueState("idle");
        setPlacementQueueMessage(
          `${result.rejectedPlacement?.displayName ?? activePlacement.displayName} rejected. Discarded the staged site change.`,
        );
      })
      .catch((error: unknown) => {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setPlacementQueueState("error");
        setPlacementQueueMessage(`Reject failed: ${detail}`);
      })
      .finally(() => {
        setPlacementControlsBusy(false);
      });
  }, [
    activePlacement,
    onPlacementRejected,
    placementRunnerAvailable,
    repaintRunnerBaseUrl,
  ]);

  return {
    placementControlsBusy,
    placementQueueState,
    placementQueueMessage: placementQueueMessage || derivedMessage,
    canQueuePlacement,
    queuePlacementLabel,
    canAcceptPlacement,
    canRejectPlacement,
    handleQueuePlacement,
    handleAcceptPlacement,
    handleRejectPlacement,
  };
}
