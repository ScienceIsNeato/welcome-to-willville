import { TOWN_OFFSET } from "@/lib/willville";
import { mostActiveStops, type Stop } from "@/lib/town";

const STOP_HIT_RADIUS = 24;
const CENTRAL_BOARD_COLUMNS = 28;
const CENTRAL_BOARD_ROWS = 6;
const CENTRAL_BOARD_EMPTY_ROW = " ".repeat(CENTRAL_BOARD_COLUMNS);

export type BoardAnnouncement = {
  rows: string[];
  label?: string;
};

export type ClientPoint = {
  clientX: number;
  clientY: number;
};

export function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function pointInRect(
  rect: DOMRect,
  xRatio: number,
  yRatio: number,
): ClientPoint {
  return {
    clientX: rect.left + rect.width * xRatio,
    clientY: rect.top + rect.height * yRatio,
  };
}

export function pointAtElementCenter(element: Element): ClientPoint {
  const rect = element.getBoundingClientRect();
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}

function dispatchPointerEvent(
  element: Element,
  type: string,
  point: ClientPoint,
  buttons: number,
  pointerId: number,
) {
  if (typeof PointerEvent === "undefined") return;
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons,
      pressure: buttons === 0 ? 0 : 0.5,
      clientX: point.clientX,
      clientY: point.clientY,
    }),
  );
}

function dispatchMouseEvent(
  element: Element,
  type: string,
  point: ClientPoint,
  buttons: number,
  detail: number,
) {
  element.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      buttons,
      detail,
      clientX: point.clientX,
      clientY: point.clientY,
    }),
  );
}

export function dispatchClickGesture(element: Element, point: ClientPoint) {
  const pointerId = 11;
  dispatchPointerEvent(element, "pointerdown", point, 1, pointerId);
  dispatchMouseEvent(element, "mousedown", point, 1, 1);
  dispatchPointerEvent(element, "pointerup", point, 0, pointerId);
  dispatchMouseEvent(element, "mouseup", point, 0, 1);
  dispatchMouseEvent(element, "click", point, 0, 1);
}

export function dispatchDoubleClickGesture(
  element: Element,
  point: ClientPoint,
) {
  const pointerId = 7;

  dispatchPointerEvent(element, "pointerdown", point, 1, pointerId);
  dispatchMouseEvent(element, "mousedown", point, 1, 1);
  dispatchPointerEvent(element, "pointerup", point, 0, pointerId);
  dispatchMouseEvent(element, "mouseup", point, 0, 1);
  dispatchMouseEvent(element, "click", point, 0, 1);

  dispatchPointerEvent(element, "pointerdown", point, 1, pointerId);
  dispatchMouseEvent(element, "mousedown", point, 1, 2);
  dispatchPointerEvent(element, "pointerup", point, 0, pointerId);
  dispatchMouseEvent(element, "mouseup", point, 0, 2);
  dispatchMouseEvent(element, "click", point, 0, 2);
  dispatchMouseEvent(element, "dblclick", point, 0, 2);
}

export function dispatchWheelGesture(
  element: Element,
  point: ClientPoint,
  deltaY: number,
) {
  element.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: point.clientX,
      clientY: point.clientY,
      deltaY,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    }),
  );
}

export async function dispatchDragGesture(
  element: Element,
  start: ClientPoint,
  end: ClientPoint,
  steps: number,
) {
  const pointerId = 9;
  dispatchPointerEvent(element, "pointerdown", start, 1, pointerId);
  dispatchMouseEvent(element, "mousedown", start, 1, 1);

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const point = {
      clientX: start.clientX + (end.clientX - start.clientX) * progress,
      clientY: start.clientY + (end.clientY - start.clientY) * progress,
    };
    dispatchPointerEvent(element, "pointermove", point, 1, pointerId);
    dispatchMouseEvent(element, "mousemove", point, 1, 1);
    await waitForNextFrame();
  }

  dispatchPointerEvent(element, "pointerup", end, 0, pointerId);
  dispatchMouseEvent(element, "mouseup", end, 0, 1);
}

export function findStopAt(
  stops: Stop[],
  wx: number,
  wy: number,
  scale: number,
): Stop | null {
  const threshold = STOP_HIT_RADIUS / scale;
  const thresholdSq = threshold * threshold;
  let best: Stop | null = null;
  let bestDist = thresholdSq;
  for (const stop of stops) {
    const sx = TOWN_OFFSET.x + stop.position.x;
    const sy = TOWN_OFFSET.y + stop.position.y;
    const dx = wx - sx;
    const dy = wy - sy;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = stop;
    }
  }
  return best;
}

function stopKey(stop: Stop): string {
  return `${stop.district}/${stop.id}`;
}

function boardStopLabel(stop: Stop): string {
  return stop.repo?.split("/").pop() ?? stop.id;
}

export function mergeStops(
  initialStops: Stop[],
  liveStops: Stop[] | null | undefined,
) {
  if (!liveStops) return initialStops;
  const liveById = new Map(liveStops.map((stop) => [stop.id, stop]));
  const merged: Stop[] = initialStops.map(
    (stop) => liveById.get(stop.id) ?? stop,
  );
  for (const stop of liveStops) {
    if (!initialStops.some((initialStop) => initialStop.id === stop.id)) {
      merged.push(stop);
    }
  }
  return merged;
}

function normalizeBoardText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9 .,'#/:!?…-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function fitBoardText(input: string): string {
  const normalized = normalizeBoardText(input);
  if (normalized.length <= CENTRAL_BOARD_COLUMNS) return normalized;
  return `${normalized.slice(0, CENTRAL_BOARD_COLUMNS - 1)}…`;
}

function centerBoardText(input: string): string {
  const fitted = fitBoardText(input);
  const left = Math.max(
    0,
    Math.floor((CENTRAL_BOARD_COLUMNS - fitted.length) / 2),
  );
  return `${" ".repeat(left)}${fitted}`.padEnd(CENTRAL_BOARD_COLUMNS, " ");
}

function stopSyncChanged(previous: Stop | undefined, next: Stop): boolean {
  if (!previous) return true;
  return (
    previous.status.updated !== next.status.updated ||
    previous.status.doing !== next.status.doing ||
    previous.status.done !== next.status.done ||
    previous.status.next !== next.status.next ||
    previous.status.blocked !== next.status.blocked ||
    previous.status.risk !== next.status.risk ||
    previous.queue?.milestone !== next.queue?.milestone ||
    previous.queue?.etaDays !== next.queue?.etaDays ||
    previous.commits3d !== next.commits3d ||
    previous.commits7d !== next.commits7d ||
    previous.commits21d !== next.commits21d ||
    previous.lastCommitAt !== next.lastCommitAt ||
    previous.activeBranch?.name !== next.activeBranch?.name ||
    previous.activeBranch?.pushedAt !== next.activeBranch?.pushedAt ||
    previous.agent?.status !== next.agent?.status ||
    previous.agent?.direction !== next.agent?.direction ||
    previous.agent?.difficulties !== next.agent?.difficulties ||
    previous.agent?.needsHuman !== next.agent?.needsHuman ||
    previous.agent?.lastUpdate !== next.agent?.lastUpdate
  );
}

function buildRouteChangeLines(
  previousStops: Stop[],
  nextStops: Stop[],
): string[] {
  const previousQueue = mostActiveStops(previousStops, 5);
  const nextQueue = mostActiveStops(nextStops, 5);
  const previousPositions = new Map(
    previousQueue.map((stop, index) => [stopKey(stop), index + 1]),
  );
  const nextKeys = new Set(nextQueue.map((stop) => stopKey(stop)));
  const lines: string[] = [];

  nextQueue.forEach((stop, index) => {
    const previousPosition = previousPositions.get(stopKey(stop));
    if (previousPosition == null) {
      lines.push(fitBoardText(`#${index + 1} ${boardStopLabel(stop)} NEW`));
      return;
    }
    if (previousPosition !== index + 1) {
      lines.push(
        fitBoardText(
          `#${index + 1} ${boardStopLabel(stop)} WAS ${previousPosition}`,
        ),
      );
    }
  });

  previousQueue.forEach((stop) => {
    if (!nextKeys.has(stopKey(stop))) {
      lines.push(fitBoardText(`${boardStopLabel(stop)} OFF ROUTE`));
    }
  });

  return lines;
}

export function buildBellBoardAnnouncement(
  previousStops: Stop[],
  nextStops: Stop[],
): BoardAnnouncement {
  const previousByKey = new Map(
    previousStops.map((stop) => [stopKey(stop), stop]),
  );
  const updatedRepos = nextStops
    .filter((stop) => stopSyncChanged(previousByKey.get(stopKey(stop)), stop))
    .sort((left, right) =>
      boardStopLabel(left).localeCompare(boardStopLabel(right)),
    )
    .map((stop) => fitBoardText(`UPD ${boardStopLabel(stop)}`));
  const routeChanges = buildRouteChangeLines(previousStops, nextStops);

  if (updatedRepos.length === 0 && routeChanges.length === 0) {
    return {
      label: "Status Update",
      rows: [
        centerBoardText("Time Central Update"),
        centerBoardText("No Recent Changes"),
        centerBoardText("Mayor's Route Steady"),
        CENTRAL_BOARD_EMPTY_ROW,
        CENTRAL_BOARD_EMPTY_ROW,
        CENTRAL_BOARD_EMPTY_ROW,
      ],
    };
  }

  const detailLines = [...updatedRepos, ...routeChanges];
  const visibleLines =
    detailLines.length > CENTRAL_BOARD_ROWS - 2
      ? [
          ...detailLines.slice(0, CENTRAL_BOARD_ROWS - 3),
          fitBoardText(
            `+${detailLines.length - (CENTRAL_BOARD_ROWS - 3)} MORE`,
          ),
        ]
      : detailLines;

  const rows = [
    centerBoardText("Time Central Update"),
    centerBoardText(
      updatedRepos.length > 0 && routeChanges.length > 0
        ? "Updated + Route Changes"
        : updatedRepos.length > 0
          ? "Updated Repos"
          : "Mayor Route Changes",
    ),
    ...visibleLines,
  ].slice(0, CENTRAL_BOARD_ROWS);

  while (rows.length < CENTRAL_BOARD_ROWS) {
    rows.push(CENTRAL_BOARD_EMPTY_ROW);
  }

  return {
    label: "Status Update",
    rows,
  };
}
