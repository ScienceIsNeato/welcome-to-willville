import type { DistrictId } from "../../lib/willville";

export type RepositionChange = {
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

export type RepaintQueueAction = "update_appearance" | "revert_appearance";

export type RepaintQueueStatus = "pending" | "running" | "done" | "failed";

export type RepaintQueueJob = {
  id: string;
  dedupeKey: string;
  status: RepaintQueueStatus;
  action: RepaintQueueAction;
  createdAt: string;
  reason: string;
  source: "reposition-endpoint";
  payload: RepositionChange;
};

export type AppearanceAuditEvent = {
  id: string;
  createdAt: string;
  action: RepaintQueueAction;
  reason: string;
  source: "reposition-endpoint";
  stopId: string;
  before: RepositionChange["from"];
  after: RepositionChange["to"];
};

type RepaintEnqueueResult = {
  queued: RepaintQueueJob[];
  deduped: RepaintQueueJob[];
  audit: AppearanceAuditEvent[];
};

let queue: RepaintQueueJob[] = [];
let auditLog: AppearanceAuditEvent[] = [];

function nowIso() {
  return new Date().toISOString();
}

function dedupeKeyForChange(
  action: RepaintQueueAction,
  change: RepositionChange,
): string {
  const from = `${change.from.district}:${change.from.x},${change.from.y}`;
  const to = `${change.to.district}:${change.to.x},${change.to.y}`;
  return `${action}:${change.stopId}:${from}->${to}`;
}

function createAuditEvent(
  action: RepaintQueueAction,
  reason: string,
  change: RepositionChange,
): AppearanceAuditEvent {
  return {
    id: crypto.randomUUID(),
    createdAt: nowIso(),
    action,
    reason,
    source: "reposition-endpoint",
    stopId: change.stopId,
    before: change.from,
    after: change.to,
  };
}

function createRepaintJob(
  action: RepaintQueueAction,
  reason: string,
  change: RepositionChange,
): RepaintQueueJob {
  return {
    id: crypto.randomUUID(),
    dedupeKey: dedupeKeyForChange(action, change),
    status: "pending",
    action,
    createdAt: nowIso(),
    reason,
    source: "reposition-endpoint",
    payload: change,
  };
}

export function enqueueRepositionRepaintJobs(
  action: RepaintQueueAction,
  reason: string,
  changes: RepositionChange[],
): RepaintEnqueueResult {
  const queued: RepaintQueueJob[] = [];
  const deduped: RepaintQueueJob[] = [];
  const audit: AppearanceAuditEvent[] = [];

  for (const change of changes) {
    const dedupeKey = dedupeKeyForChange(action, change);
    const existing = queue.find(
      (job) =>
        job.dedupeKey === dedupeKey &&
        (job.status === "pending" || job.status === "running"),
    );

    if (existing) {
      deduped.push(existing);
      continue;
    }

    const job = createRepaintJob(action, reason, change);
    const event = createAuditEvent(action, reason, change);

    queue = [...queue, job];
    auditLog = [...auditLog, event];

    queued.push(job);
    audit.push(event);
  }

  return { queued, deduped, audit };
}

export function readRepaintQueue(limit = 100): RepaintQueueJob[] {
  return queue.slice(-Math.max(1, limit));
}

export function readAppearanceAudit(limit = 200): AppearanceAuditEvent[] {
  return auditLog.slice(-Math.max(1, limit));
}
