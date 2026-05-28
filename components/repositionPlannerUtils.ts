import type { Stop } from "@/lib/town";
import type { ManualStop } from "@/lib/willville";
import type { Heuristic } from "@/lib/willville.heuristics";

export type RepositionStopDelta = {
  original: { x: number; y: number; district: ManualStop["district"] };
  current: { x: number; y: number; district: ManualStop["district"] };
};

export function formatHeuristics(
  heuristics: readonly Heuristic[],
  updatedStops: Stop[],
): string {
  const repoStops = updatedStops.filter((stop) => stop.repo && !stop.isManual);

  const items = repoStops.map((stop) => {
    const original = heuristics.find(
      (heuristic) => heuristic.repo.toLowerCase() === stop.repo?.toLowerCase(),
    );
    const lines = JSON.stringify(stop.lines);
    const position = `{ x: ${stop.position.x}, y: ${stop.position.y} }`;
    const parts = [
      `    repo: ${JSON.stringify(stop.repo)},`,
      `    displayName: ${JSON.stringify(stop.displayName)},`,
      `    district: ${JSON.stringify(stop.district)},`,
      `    lines: ${lines},`,
      `    position: ${position},`,
    ];

    if (original) {
      if (original.blurb) {
        parts.push(`    blurb: ${JSON.stringify(original.blurb)},`);
      }
    } else if (stop.blurb) {
      parts.push(`    blurb: ${JSON.stringify(stop.blurb)},`);
    }

    if (original?.queue) {
      const queue = original.queue;
      const queueBody =
        `{
      active: ${queue.active},` +
        (queue.milestone
          ? `
      milestone: ${JSON.stringify(queue.milestone)},`
          : "") +
        (queue.etaDays !== undefined
          ? `
      etaDays: ${queue.etaDays},`
          : "") +
        (queue.priority !== undefined
          ? `
      priority: ${queue.priority},`
          : "") +
        `
    }`;
      parts.push(`    queue: ${queueBody},`);
    }

    return `  {
${parts.join("\n")}
  }`;
  });

  return `export const HEURISTICS: Heuristic[] = [\n${items.join(",\n\n")}\n];`;
}

export function formatManualStops(
  manualStops: readonly ManualStop[],
  updatedStops: Stop[],
): string {
  const manualOnlyStops = updatedStops.filter((stop) => stop.isManual === true);

  const items = manualOnlyStops.map((stop) => {
    const original = manualStops.find(
      (manualStop) => manualStop.id === stop.id,
    );
    const lines = JSON.stringify(stop.lines);
    const position = `{ x: ${stop.position.x}, y: ${stop.position.y} }`;
    const parts = [
      `    id: ${JSON.stringify(stop.id)},`,
      `    displayName: ${JSON.stringify(stop.displayName)},`,
      `    district: ${JSON.stringify(stop.district)},`,
      `    lines: ${lines},`,
      `    position: ${position},`,
    ];

    if (original) {
      if (original.homepage) {
        parts.push(`    homepage: ${JSON.stringify(original.homepage)},`);
      }

      if (original.blurb) {
        parts.push(`    blurb: ${JSON.stringify(original.blurb)},`);
      }

      if (original.statusState) {
        parts.push(`    statusState: ${JSON.stringify(original.statusState)},`);
      }
    } else {
      if (stop.homepage) {
        parts.push(`    homepage: ${JSON.stringify(stop.homepage)},`);
      }

      if (stop.blurb) {
        parts.push(`    blurb: ${JSON.stringify(stop.blurb)},`);
      }

      if (stop.status?.state) {
        parts.push(`    statusState: ${JSON.stringify(stop.status.state)},`);
      }
    }

    return `  {
${parts.join("\n")}
  }`;
  });

  return `export const MANUAL_STOPS: ManualStop[] = [\n${items.join(",\n\n")}\n];`;
}
