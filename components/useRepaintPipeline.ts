"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Stop } from "@/lib/town";
import {
  siteCanRunLiveRepaint,
  siteLiveRepaintSupportReason,
} from "@/lib/siteAppearance";
import { getBellErrorDetail } from "./townStageUtils";
import type { RepositionStopDelta } from "./repositionPlannerUtils";
import type {
  RepaintQueueApiResponse,
  RepaintQueueJobRecord,
} from "./repaintPipelineTypes";

type RepaintQueueState = "idle" | "running" | "review" | "error";

type UseRepaintPipelineParams = {
  isClient: boolean;
  isRepositionMode: boolean;
  plannerStop: Stop | null;
  movedStops: Record<string, RepositionStopDelta>;
};

export function useRepaintPipeline({
  isClient,
  isRepositionMode,
  plannerStop,
  movedStops,
}: UseRepaintPipelineParams) {
  const [repaintQueueState, setRepaintQueueState] =
    useState<RepaintQueueState>("idle");
  const [repaintQueueMessage, setRepaintQueueMessage] = useState("");
  const [activeRepaintJob, setActiveRepaintJob] =
    useState<RepaintQueueJobRecord | null>(null);
  const [acceptedRepaintPreviews, setAcceptedRepaintPreviews] = useState<
    NonNullable<RepaintQueueApiResponse["acceptedPreviews"]>
  >([]);
  const [repaintRunnerAvailable, setRepaintRunnerAvailable] = useState(false);
  const [repaintControlsBusy, setRepaintControlsBusy] = useState(false);

  const repaintRunnerBaseUrl = useMemo(() => {
    if (!isClient) {
      return null;
    }

    const { protocol, hostname, port } = window.location;
    if (
      hostname !== "127.0.0.1" &&
      hostname !== "localhost" &&
      hostname !== "::1"
    ) {
      return null;
    }

    const numericPort = Number.parseInt(port, 10);
    if (!Number.isFinite(numericPort)) {
      return null;
    }

    return `${protocol}//${hostname}:${numericPort + 1}`;
  }, [isClient]);

  const buildRepaintRunnerHref = useCallback(
    (path: string, cacheBust: string) => {
      if (!repaintRunnerBaseUrl) {
        return null;
      }

      return `${repaintRunnerBaseUrl}${path}?v=${encodeURIComponent(cacheBust)}`;
    },
    [repaintRunnerBaseUrl],
  );

  const previewUnderlayHrefs = useMemo(() => {
    const next: Record<string, string> = {};

    for (const preview of acceptedRepaintPreviews) {
      const href = buildRepaintRunnerHref(preview.path, preview.cacheBust);
      if (href) {
        next[preview.stopId] = href;
      }
    }

    if (
      activeRepaintJob?.preview &&
      ["awaiting_review", "failed", "reverting"].includes(
        activeRepaintJob.status,
      )
    ) {
      const href = buildRepaintRunnerHref(
        activeRepaintJob.preview.path,
        activeRepaintJob.preview.cacheBust,
      );
      if (href) {
        next[activeRepaintJob.preview.stopId] = href;
      }
    }

    return next;
  }, [acceptedRepaintPreviews, activeRepaintJob, buildRepaintRunnerHref]);

  const replacementUnderlayStopIds = useMemo(
    () => new Set(Object.keys(previewUnderlayHrefs)),
    [previewUnderlayHrefs],
  );

  const repaintCliOutput = useMemo(() => {
    if (!activeRepaintJob?.logs || activeRepaintJob.logs.length === 0) {
      return "";
    }

    return activeRepaintJob.logs
      .map((line) => {
        const prefix =
          line.stream === "stderr" ? "!" : line.stream === "system" ? "$" : ">";
        return `${prefix} ${line.text}`;
      })
      .join("\n");
  }, [activeRepaintJob]);

  const syncRepaintQueue = useCallback(
    async ({ silenceErrors = false }: { silenceErrors?: boolean } = {}) => {
      if (!isRepositionMode || !repaintRunnerBaseUrl) {
        setRepaintRunnerAvailable(false);
        setActiveRepaintJob(null);
        setAcceptedRepaintPreviews([]);
        if (!silenceErrors && isRepositionMode) {
          setRepaintQueueState("error");
          setRepaintQueueMessage(
            "Live repaint runner is offline. Restart with scripts/deploy_app.sh to run the real repaint pipeline.",
          );
        }
        return;
      }

      try {
        const response = await fetch(`${repaintRunnerBaseUrl}/status`);
        if (!response.ok) {
          throw new Error(await getBellErrorDetail(response));
        }

        const result = (await response.json()) as RepaintQueueApiResponse;
        setRepaintRunnerAvailable(true);
        setActiveRepaintJob(result.activeJob ?? null);
        setAcceptedRepaintPreviews(result.acceptedPreviews ?? []);
        setRepaintQueueState(() => {
          if (!result.activeJob) {
            return "idle";
          }

          if (result.activeJob.status === "awaiting_review") {
            return "review";
          }

          if (result.activeJob.status === "failed") {
            return "error";
          }

          return "running";
        });
      } catch (error: unknown) {
        setRepaintRunnerAvailable(false);
        if (silenceErrors) {
          return;
        }

        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setRepaintQueueState("error");
        setRepaintQueueMessage(`Repaint runner refresh failed: ${detail}`);
      }
    },
    [isRepositionMode, repaintRunnerBaseUrl],
  );

  useEffect(() => {
    if (!isRepositionMode || !repaintRunnerBaseUrl) {
      return;
    }

    const initialRefreshId = window.setTimeout(() => {
      void syncRepaintQueue({ silenceErrors: true });
    }, 0);
    const intervalId = window.setInterval(() => {
      void syncRepaintQueue({ silenceErrors: true });
    }, 3000);

    return () => {
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
    };
  }, [isRepositionMode, repaintRunnerBaseUrl, syncRepaintQueue]);

  const queueRepaintLabel = !repaintRunnerAvailable
    ? "🚫 Repaint Runner Offline"
    : activeRepaintJob
      ? activeRepaintJob.stopId === plannerStop?.id
        ? activeRepaintJob.status === "awaiting_review"
          ? "🧪 Candidate Ready"
          : activeRepaintJob.status === "failed"
            ? "⚠️ Pipeline Failed"
            : "⏳ Repainting..."
        : "⛔ Queue Full"
      : plannerStop && !siteCanRunLiveRepaint(plannerStop.id)
        ? "🚫 Repaint Unsupported"
        : plannerStop
          ? `🎨 Repaint ${plannerStop.displayName}`
          : "🎨 Repaint Selected Site";

  const queueRepaintMessage = !repaintRunnerAvailable
    ? "Live repaint runner is offline. Restart with scripts/deploy_app.sh to run the real repaint pipeline."
    : activeRepaintJob
      ? activeRepaintJob.stopId === plannerStop?.id
        ? activeRepaintJob.status === "awaiting_review"
          ? `${activeRepaintJob.displayName} has a live candidate on the map. Accept keeps the baked repaint, switches the site to background-only, and hides the separate glyph. Reject restores the previous manifest and art.`
          : activeRepaintJob.status === "failed"
            ? `${activeRepaintJob.displayName} failed during repaint. Review the CLI output below, then reject to restore the previous files.`
            : `Running the live repaint pipeline for ${activeRepaintJob.displayName}. CLI output is streaming below.`
        : `${activeRepaintJob.displayName} is using the only repaint slot. Wait for that run to finish before queueing ${plannerStop?.displayName ?? "another site"}.`
      : plannerStop && !siteCanRunLiveRepaint(plannerStop.id)
        ? siteLiveRepaintSupportReason(plannerStop.id)
        : repaintQueueMessage;

  const canQueueRepaint =
    Boolean(plannerStop) &&
    repaintRunnerAvailable &&
    !activeRepaintJob &&
    siteCanRunLiveRepaint(plannerStop?.id ?? "");
  const canAcceptRepaint = Boolean(
    activeRepaintJob && activeRepaintJob.status === "awaiting_review",
  );
  const canRejectRepaint = Boolean(
    activeRepaintJob &&
    ["awaiting_review", "failed"].includes(activeRepaintJob.status),
  );
  const canCancelRepaint = Boolean(
    activeRepaintJob && ["queued", "running"].includes(activeRepaintJob.status),
  );

  const handleQueueRepaint = useCallback(() => {
    if (!plannerStop || !repaintRunnerBaseUrl || activeRepaintJob) {
      return;
    }

    const plannerStopChange = movedStops[plannerStop.id];
    const change = plannerStopChange
      ? {
          stopId: plannerStop.id,
          from: {
            x: plannerStopChange.original.x,
            y: plannerStopChange.original.y,
            district: plannerStopChange.original.district,
          },
          to: {
            x: plannerStopChange.current.x,
            y: plannerStopChange.current.y,
            district: plannerStopChange.current.district,
          },
        }
      : {
          stopId: plannerStop.id,
          from: {
            x: plannerStop.position.x,
            y: plannerStop.position.y,
            district: plannerStop.district,
          },
          to: {
            x: plannerStop.position.x,
            y: plannerStop.position.y,
            district: plannerStop.district,
          },
        };

    setRepaintQueueState("running");
    setRepaintControlsBusy(true);
    setRepaintQueueMessage(
      `Starting the live repaint pipeline for ${plannerStop.displayName}...`,
    );

    fetch(`${repaintRunnerBaseUrl}/queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        change,
        displayName: plannerStop.displayName,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getBellErrorDetail(response));
        }

        return response.json() as Promise<RepaintQueueApiResponse>;
      })
      .then((result) => {
        setRepaintRunnerAvailable(true);
        setActiveRepaintJob(result.activeJob ?? null);
        setAcceptedRepaintPreviews(result.acceptedPreviews ?? []);
        setRepaintQueueState(result.activeJob ? "running" : "idle");
        setRepaintQueueMessage(
          `Started the live repaint pipeline for ${plannerStop.displayName}.`,
        );
      })
      .catch((error: unknown) => {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setRepaintQueueState("error");
        setRepaintQueueMessage(`Queue request failed: ${detail}`);
      })
      .finally(() => {
        setRepaintControlsBusy(false);
      });
  }, [activeRepaintJob, movedStops, plannerStop, repaintRunnerBaseUrl]);

  const handleAcceptRepaint = useCallback(() => {
    if (!activeRepaintJob || !repaintRunnerBaseUrl) {
      return;
    }

    setRepaintQueueState("running");
    setRepaintControlsBusy(true);
    setRepaintQueueMessage(`Accepting ${activeRepaintJob.displayName}...`);

    fetch(`${repaintRunnerBaseUrl}/accept`, {
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getBellErrorDetail(response));
        }

        return response.json() as Promise<RepaintQueueApiResponse>;
      })
      .then((result) => {
        setActiveRepaintJob(result.activeJob ?? null);
        setAcceptedRepaintPreviews(result.acceptedPreviews ?? []);
        setRepaintQueueState("idle");
        setRepaintQueueMessage(
          `${result.acceptedJob?.displayName ?? activeRepaintJob.displayName} accepted. The baked repaint now carries the site art, the separate glyph is hidden, and the preview stays overlaid locally until the next deploy bakes it in.`,
        );
      })
      .catch((error: unknown) => {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setRepaintQueueState("error");
        setRepaintQueueMessage(`Accept failed: ${detail}`);
      })
      .finally(() => {
        setRepaintControlsBusy(false);
      });
  }, [activeRepaintJob, repaintRunnerBaseUrl]);

  const handleRejectRepaint = useCallback(() => {
    if (!activeRepaintJob || !repaintRunnerBaseUrl) {
      return;
    }

    setRepaintQueueState("running");
    setRepaintControlsBusy(true);
    setRepaintQueueMessage(
      `Rejecting ${activeRepaintJob.displayName} and restoring backups...`,
    );

    fetch(`${repaintRunnerBaseUrl}/reject`, {
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getBellErrorDetail(response));
        }

        return response.json() as Promise<RepaintQueueApiResponse>;
      })
      .then((result) => {
        setActiveRepaintJob(result.activeJob ?? null);
        setAcceptedRepaintPreviews(result.acceptedPreviews ?? []);
        setRepaintQueueState("idle");
        setRepaintQueueMessage(
          `${result.rejectedJob?.displayName ?? activeRepaintJob.displayName} rejected. Restored the previous manifest and underlay art.`,
        );
      })
      .catch((error: unknown) => {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setRepaintQueueState("error");
        setRepaintQueueMessage(`Reject failed: ${detail}`);
      })
      .finally(() => {
        setRepaintControlsBusy(false);
      });
  }, [activeRepaintJob, repaintRunnerBaseUrl]);

  const handleCancelRepaint = useCallback(() => {
    if (!activeRepaintJob || !repaintRunnerBaseUrl) {
      return;
    }

    setRepaintQueueState("running");
    setRepaintControlsBusy(true);
    setRepaintQueueMessage(
      `Canceling the live repaint preview for ${activeRepaintJob.displayName}...`,
    );

    fetch(`${repaintRunnerBaseUrl}/cancel`, {
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getBellErrorDetail(response));
        }

        return response.json() as Promise<
          RepaintQueueApiResponse & {
            canceledJob?: { displayName: string };
          }
        >;
      })
      .then((result) => {
        setActiveRepaintJob(result.activeJob ?? null);
        setAcceptedRepaintPreviews(result.acceptedPreviews ?? []);
        setRepaintQueueState("idle");
        setRepaintQueueMessage(
          `${result.canceledJob?.displayName ?? activeRepaintJob.displayName} preview canceled. Restored the previous art backup and reopened the queue.`,
        );
      })
      .catch((error: unknown) => {
        const detail =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        setRepaintQueueState("error");
        setRepaintQueueMessage(`Cancel failed: ${detail}`);
      })
      .finally(() => {
        setRepaintControlsBusy(false);
      });
  }, [activeRepaintJob, repaintRunnerBaseUrl]);

  return {
    previewUnderlayHrefs,
    replacementUnderlayStopIds,
    repaintControlsBusy,
    repaintQueueState,
    repaintQueueMessage: queueRepaintMessage,
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
  };
}
