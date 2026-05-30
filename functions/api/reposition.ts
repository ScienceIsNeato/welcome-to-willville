import type { PagesFunction } from "../types";
import { isKnownDistrict } from "../../lib/slugs";
import {
  clearActiveRepaintJob,
  enqueueRepositionRepaintJobs,
  readActiveRepaintJob,
  readAppearanceAudit,
  readRepaintQueue,
  type RepaintQueueAction,
  type RepositionChange,
} from "./reposition-queue";
import { withCorsHeaders } from "./cors";

interface Env {
  WILLVILLE_AUTHORING_KEY?: string;
}

type RepositionPayload = {
  action?: RepaintQueueAction;
  reason?: string;
  changes?: RepositionChange[];
};

const DEFAULT_REASON = "Reposition planner requested repaint";

function isValidAction(value: unknown): value is RepaintQueueAction {
  return value === "update_appearance" || value === "revert_appearance";
}

function isValidChangePoint(value: unknown): value is RepositionChange["from"] {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const point = value as { x?: unknown; y?: unknown; district?: unknown };
  const x = point.x;
  const y = point.y;

  return (
    typeof x === "number" &&
    Number.isFinite(x) &&
    typeof y === "number" &&
    Number.isFinite(y) &&
    isValidDistrict(point.district)
  );
}

function isValidDistrict(
  value: unknown,
): value is RepositionChange["to"]["district"] {
  return typeof value === "string" && isKnownDistrict(value);
}

function isValidRepositionChange(value: unknown): value is RepositionChange {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const change = value as {
    stopId?: unknown;
    from?: { x?: unknown; y?: unknown; district?: unknown };
    to?: { x?: unknown; y?: unknown; district?: unknown };
  };

  if (typeof change.stopId !== "string" || change.stopId.trim().length === 0) {
    return false;
  }

  if (!change.from || !isValidChangePoint(change.from)) {
    return false;
  }

  if (!change.to || !isValidChangePoint(change.to)) {
    return false;
  }

  return true;
}

function parseLimit(url: URL): number {
  const raw = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  if (!Number.isFinite(raw)) {
    return 50;
  }
  return Math.max(1, Math.min(500, raw));
}

function requestIsAuthoring(request: Request, env: Env): boolean {
  const requiredKey = env.WILLVILLE_AUTHORING_KEY;
  if (requiredKey) {
    return request.headers.get("x-willville-authoring-key") === requiredKey;
  }

  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: withCorsHeaders(request),
  });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!requestIsAuthoring(request, env)) {
    return new Response(JSON.stringify({ error: "Authoring-only endpoint" }), {
      status: 403,
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json",
      }),
    });
  }

  const limit = parseLimit(new URL(request.url));
  const activeJob = readActiveRepaintJob();

  return new Response(
    JSON.stringify({
      capacity: 1,
      available: !activeJob,
      activeJob,
      queue: readRepaintQueue(limit),
      audit: readAppearanceAudit(limit),
    }),
    {
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json",
      }),
    },
  );
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!requestIsAuthoring(request, env)) {
    return new Response(JSON.stringify({ error: "Authoring-only endpoint" }), {
      status: 403,
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json",
      }),
    });
  }

  let payload: RepositionPayload;

  try {
    payload = (await request.json()) as RepositionPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json",
      }),
    });
  }

  const action = isValidAction(payload.action)
    ? payload.action
    : "update_appearance";
  const reason = payload.reason?.trim() || DEFAULT_REASON;
  const changes = Array.isArray(payload.changes)
    ? payload.changes.filter(isValidRepositionChange)
    : [];

  if (changes.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No valid reposition changes found in payload",
      }),
      {
        status: 400,
        headers: withCorsHeaders(request, {
          "Content-Type": "application/json",
        }),
      },
    );
  }

  if (changes.length > 1) {
    return new Response(
      JSON.stringify({
        error:
          "Repaint queue only supports one site at a time. Submit a single change.",
      }),
      {
        status: 400,
        headers: withCorsHeaders(request, {
          "Content-Type": "application/json",
        }),
      },
    );
  }

  const result = enqueueRepositionRepaintJobs(action, reason, changes);

  if (result.blockedBy && result.queued.length === 0) {
    return new Response(
      JSON.stringify({
        error: `A repaint job is already queued for ${result.blockedBy.payload.stopId}. Clear it before queueing another site.`,
        capacity: 1,
        available: false,
        activeJob: result.blockedBy,
        queued: 0,
        deduped: result.deduped.length,
      }),
      {
        status: 409,
        headers: withCorsHeaders(request, {
          "Content-Type": "application/json",
        }),
      },
    );
  }

  return new Response(
    JSON.stringify({
      action,
      reason,
      capacity: 1,
      available: !result.activeJob,
      activeJob: result.activeJob,
      requested: changes.length,
      queued: result.queued.length,
      deduped: result.deduped.length,
      jobs: result.queued,
      audit: result.audit,
    }),
    {
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json",
      }),
    },
  );
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  if (!requestIsAuthoring(request, env)) {
    return new Response(JSON.stringify({ error: "Authoring-only endpoint" }), {
      status: 403,
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json",
      }),
    });
  }

  const clearedJob = clearActiveRepaintJob("done");

  return new Response(
    JSON.stringify({
      capacity: 1,
      available: true,
      activeJob: readActiveRepaintJob(),
      cleared: Boolean(clearedJob),
      clearedJob,
    }),
    {
      headers: withCorsHeaders(request, {
        "Content-Type": "application/json",
      }),
    },
  );
};
