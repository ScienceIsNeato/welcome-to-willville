"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export type TownPerfPhase =
  | "layoutRead"
  | "cameraMath"
  | "motionWrites"
  | "domApply"
  | "frameWait"
  | "settleWait";

export type TownPerfProbe = {
  measure<T>(phase: Exclude<TownPerfPhase, "frameWait">, fn: () => T): T;
  scheduleFrameSample(): void;
};

export type TownPerfFps = {
  avgFps: number;
  minFps: number;
  maxFps: number;
  frameCount: number;
  droppedFrames: number;
  longFrames: number;
};

export type TownPerfLongTask = {
  startedAtMs: number;
  durationMs: number;
};

export type TownPerfDomSnapshot = {
  totalNodes: number;
  svgElements: number;
  stopMarkers: number;
};

export type TownPerfMemorySnapshot = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
};

export type TownPerfMemorySummary = {
  startHeap: number;
  endHeap: number;
  peakHeap: number;
  growthBytes: number;
  growthPct: number;
};

export type TownPerfReportStep = {
  id: string;
  label: string;
  ms: number;
  pct: number;
  startedAtMs: number;
  fps?: TownPerfFps;
  domSnapshot?: TownPerfDomSnapshot;
  memory?: TownPerfMemorySnapshot;
};

export type TownPerfReportBlock = {
  id: string;
  label: string;
  ms: number;
  pct: number;
  depth: number;
  startedAtMs: number;
};

type TownPerfReportPhase = {
  key: TownPerfPhase;
  label: string;
  ms: number;
  pct: number;
  samples: number;
  avgMs: number;
};

export type TownPerfStepDelta = {
  stepId: string;
  deltaMs: number;
  deltaPct: number;
  deltaFpsAvg: number | null;
};

export type TownPerfBaseline = {
  savedAt: string;
  totalMs: number;
  avgFps: number;
  steps: Array<{ id: string; ms: number; avgFps: number }>;
};

export type TownPerfBaselineComparison = {
  deltaTotalMs: number;
  deltaTotalPct: number;
  deltaAvgFps: number;
  stepDeltas: TownPerfStepDelta[];
};

export type TownPerfReport = {
  scenario: string;
  startedAt: string;
  finishedAt: string;
  totalMs: number;
  fps: TownPerfFps;
  memory: TownPerfMemorySummary | null;
  longTasks: TownPerfLongTask[];
  steps: TownPerfReportStep[];
  blocks: TownPerfReportBlock[];
  largestBlock: TownPerfReportBlock | null;
  phases: TownPerfReportPhase[];
  baselineComparison: TownPerfBaselineComparison | null;
};

type ScenarioMeta = {
  scenario: string;
  startedAtMs: number;
  startedAtIso: string;
};

const PHASE_LABELS: Record<TownPerfPhase, string> = {
  layoutRead: "Layout read",
  cameraMath: "Camera math",
  motionWrites: "Motion writes",
  domApply: "DOM apply",
  frameWait: "Frame wait",
  settleWait: "Settle wait",
};

const PHASE_ORDER: TownPerfPhase[] = [
  "layoutRead",
  "cameraMath",
  "motionWrites",
  "domApply",
  "frameWait",
  "settleWait",
];

function emptyPhaseTotals(): Record<TownPerfPhase, number> {
  return {
    layoutRead: 0,
    cameraMath: 0,
    motionWrites: 0,
    domApply: 0,
    frameWait: 0,
    settleWait: 0,
  };
}

function emptyPhaseCounts(): Record<TownPerfPhase, number> {
  return {
    layoutRead: 0,
    cameraMath: 0,
    motionWrites: 0,
    domApply: 0,
    frameWait: 0,
    settleWait: 0,
  };
}

const LONG_FRAME_THRESHOLD_MS = 33.34; // below 30fps
const DROPPED_FRAME_THRESHOLD_MS = 50; // below 20fps

type FrameSample = { ts: number; deltaMs: number };

function computeFps(samples: FrameSample[]): TownPerfFps {
  if (samples.length === 0) {
    return {
      avgFps: 0,
      minFps: 0,
      maxFps: 0,
      frameCount: 0,
      droppedFrames: 0,
      longFrames: 0,
    };
  }
  let minFps = Infinity;
  let maxFps = 0;
  let droppedFrames = 0;
  let longFrames = 0;
  let fpsSum = 0;
  for (const sample of samples) {
    const fps = sample.deltaMs > 0 ? 1000 / sample.deltaMs : 0;
    fpsSum += fps;
    if (fps < minFps) minFps = fps;
    if (fps > maxFps) maxFps = fps;
    if (sample.deltaMs > DROPPED_FRAME_THRESHOLD_MS) droppedFrames++;
    if (sample.deltaMs > LONG_FRAME_THRESHOLD_MS) longFrames++;
  }
  return {
    avgFps: Math.round(fpsSum / samples.length),
    minFps: Math.round(minFps),
    maxFps: Math.round(maxFps),
    frameCount: samples.length,
    droppedFrames,
    longFrames,
  };
}

type PerformanceMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

function captureMemorySnapshot(): TownPerfMemorySnapshot | undefined {
  const mem = (performance as unknown as { memory?: PerformanceMemory }).memory;
  if (!mem) return undefined;
  return {
    usedJSHeapSize: mem.usedJSHeapSize,
    totalJSHeapSize: mem.totalJSHeapSize,
  };
}

function captureDomSnapshot(): TownPerfDomSnapshot {
  return {
    totalNodes: document.querySelectorAll("*").length,
    svgElements: document.querySelectorAll("svg *").length,
    stopMarkers: document.querySelectorAll("[data-stop-marker]").length,
  };
}

function sliceSamples(
  samples: FrameSample[],
  startMs: number,
  endMs: number,
): FrameSample[] {
  return samples.filter((s) => s.ts >= startMs && s.ts <= endMs);
}

const BASELINE_KEY = "willville-perf-baseline";

function loadBaseline(): TownPerfBaseline | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TownPerfBaseline;
  } catch {
    return null;
  }
}

function saveBaseline(report: TownPerfReport): void {
  const baseline: TownPerfBaseline = {
    savedAt: new Date().toISOString(),
    totalMs: report.totalMs,
    avgFps: report.fps.avgFps,
    steps: report.steps.map((s) => ({
      id: s.id,
      ms: s.ms,
      avgFps: s.fps?.avgFps ?? 0,
    })),
  };
  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline));
  } catch {
    // storage full or unavailable
  }
}

function clearBaseline(): void {
  try {
    localStorage.removeItem(BASELINE_KEY);
  } catch {
    // ignore
  }
}

function compareToBaseline(
  report: { totalMs: number; fps: TownPerfFps; steps: TownPerfReportStep[] },
  baseline: TownPerfBaseline,
): TownPerfBaselineComparison {
  const deltaTotalMs = report.totalMs - baseline.totalMs;
  const deltaTotalPct =
    baseline.totalMs > 0 ? (deltaTotalMs / baseline.totalMs) * 100 : 0;
  const deltaAvgFps = report.fps.avgFps - baseline.avgFps;

  const baselineStepMap = new Map(
    baseline.steps.map((s) => [s.id, s]),
  );

  const stepDeltas: TownPerfStepDelta[] = report.steps.map((step) => {
    const base = baselineStepMap.get(step.id);
    if (!base) {
      return { stepId: step.id, deltaMs: 0, deltaPct: 0, deltaFpsAvg: null };
    }
    const deltaMs = step.ms - base.ms;
    const deltaPct = base.ms > 0 ? (deltaMs / base.ms) * 100 : 0;
    const deltaFpsAvg =
      step.fps && base.avgFps > 0
        ? step.fps.avgFps - base.avgFps
        : null;
    return { stepId: step.id, deltaMs, deltaPct, deltaFpsAvg };
  });

  return { deltaTotalMs, deltaTotalPct, deltaAvgFps, stepDeltas };
}

export function useTownInteractionProfiler(enabled: boolean) {
  const scenarioRef = useRef<ScenarioMeta | null>(null);
  const phaseTotalsRef =
    useRef<Record<TownPerfPhase, number>>(emptyPhaseTotals());
  const phaseCountsRef =
    useRef<Record<TownPerfPhase, number>>(emptyPhaseCounts());
  const frameStartRef = useRef<number | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const stepsRef = useRef<TownPerfReportStep[]>([]);
  const blocksRef = useRef<TownPerfReportBlock[]>([]);
  const blockDepthRef = useRef(0);
  const recordingRef = useRef(false);
  const fpsLoopIdRef = useRef<number | null>(null);
  const fpsLastFrameRef = useRef<number | null>(null);
  const fpsSamplesRef = useRef<FrameSample[]>([]);
  const longTasksRef = useRef<TownPerfLongTask[]>([]);
  const longTaskObserverRef = useRef<PerformanceObserver | null>(null);
  const startHeapRef = useRef<number | null>(null);
  const [report, setReport] = useState<TownPerfReport | null>(null);
  const [running, setRunning] = useState(false);

  const stopFpsLoop = useCallback(() => {
    if (fpsLoopIdRef.current !== null) {
      window.cancelAnimationFrame(fpsLoopIdRef.current);
      fpsLoopIdRef.current = null;
    }
    fpsLastFrameRef.current = null;
  }, []);

  const startFpsLoop = useCallback(() => {
    stopFpsLoop();
    fpsSamplesRef.current = [];
    fpsLastFrameRef.current = null;
    const loop = (now: number) => {
      if (!recordingRef.current) return;
      const last = fpsLastFrameRef.current;
      if (last !== null) {
        const deltaMs = now - last;
        if (deltaMs > 0) {
          fpsSamplesRef.current.push({ ts: now, deltaMs });
        }
      }
      fpsLastFrameRef.current = now;
      fpsLoopIdRef.current = window.requestAnimationFrame(loop);
    };
    fpsLoopIdRef.current = window.requestAnimationFrame(loop);
  }, [stopFpsLoop]);

  const stopLongTaskObserver = useCallback(() => {
    if (longTaskObserverRef.current) {
      longTaskObserverRef.current.disconnect();
      longTaskObserverRef.current = null;
    }
  }, []);

  const startLongTaskObserver = useCallback(() => {
    stopLongTaskObserver();
    longTasksRef.current = [];
    if (typeof PerformanceObserver === "undefined") return;
    try {
      const scenarioStart = scenarioRef.current?.startedAtMs ?? 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasksRef.current.push({
            startedAtMs: entry.startTime - scenarioStart,
            durationMs: entry.duration,
          });
        }
      });
      observer.observe({ type: "longtask", buffered: false });
      longTaskObserverRef.current = observer;
    } catch {
      // longtask not supported in this browser
    }
  }, [stopLongTaskObserver]);

  const resetAccumulators = useCallback(() => {
    phaseTotalsRef.current = emptyPhaseTotals();
    phaseCountsRef.current = emptyPhaseCounts();
    stepsRef.current = [];
    blocksRef.current = [];
    blockDepthRef.current = 0;
    frameStartRef.current = null;
    fpsSamplesRef.current = [];
    longTasksRef.current = [];
    if (frameTimerRef.current !== null) {
      window.cancelAnimationFrame(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    stopFpsLoop();
    stopLongTaskObserver();
  }, [stopFpsLoop, stopLongTaskObserver]);

  const clearReport = useCallback(() => {
    resetAccumulators();
    scenarioRef.current = null;
    recordingRef.current = false;
    setRunning(false);
    setReport(null);
  }, [resetAccumulators]);

  const startScenario = useCallback(
    (scenario: string) => {
      resetAccumulators();
      scenarioRef.current = {
        scenario,
        startedAtMs: performance.now(),
        startedAtIso: new Date().toISOString(),
      };
      recordingRef.current = true;
      startHeapRef.current =
        captureMemorySnapshot()?.usedJSHeapSize ?? null;
      setRunning(true);
      setReport(null);
      startFpsLoop();
      startLongTaskObserver();
    },
    [resetAccumulators, startFpsLoop, startLongTaskObserver],
  );

  const runStep = useCallback(
    async <T>(id: string, label: string, fn: () => Promise<T> | T) => {
      const scenario = scenarioRef.current;
      const absStart = performance.now();
      const result = await fn();
      const absEnd = performance.now();
      const ms = absEnd - absStart;
      const stepFps = enabled
        ? computeFps(sliceSamples(fpsSamplesRef.current, absStart, absEnd))
        : undefined;
      const domSnapshot = enabled ? captureDomSnapshot() : undefined;
      const memorySnap = enabled ? captureMemorySnapshot() : undefined;
      stepsRef.current.push({
        id,
        label,
        ms,
        pct: 0,
        startedAtMs: scenario ? absStart - scenario.startedAtMs : 0,
        fps: stepFps,
        domSnapshot,
        memory: memorySnap,
      });
      return result;
    },
    [enabled],
  );

  const runBlock = useCallback(
    async <T>(id: string, label: string, fn: () => Promise<T> | T) => {
      if (!enabled || !recordingRef.current) return fn();

      const scenario = scenarioRef.current;
      const startedAtMs = performance.now();
      const depth = blockDepthRef.current;
      blockDepthRef.current += 1;

      try {
        return await fn();
      } finally {
        blockDepthRef.current = depth;
        const ms = performance.now() - startedAtMs;
        if (ms > 0) {
          blocksRef.current.push({
            id,
            label,
            ms,
            pct: 0,
            depth,
            startedAtMs: scenario ? startedAtMs - scenario.startedAtMs : 0,
          });
        }
      }
    },
    [enabled],
  );

  const finishScenario = useCallback(() => {
    const scenario = scenarioRef.current;
    if (!scenario) return null;

    recordingRef.current = false;
    stopFpsLoop();
    stopLongTaskObserver();
    setRunning(false);

    const finishedAt = new Date().toISOString();
    const totalMs = performance.now() - scenario.startedAtMs;
    const safeTotalMs = Math.max(totalMs, 0.0001);

    const fps = computeFps(fpsSamplesRef.current);
    const longTasks = [...longTasksRef.current];

    // Memory summary
    let memory: TownPerfMemorySummary | null = null;
    const startHeap = startHeapRef.current;
    const endSnap = captureMemorySnapshot();
    if (startHeap !== null && endSnap) {
      const stepHeaps = stepsRef.current
        .map((s) => s.memory?.usedJSHeapSize)
        .filter((v): v is number => v !== undefined);
      const peakHeap = Math.max(startHeap, endSnap.usedJSHeapSize, ...stepHeaps);
      const growthBytes = endSnap.usedJSHeapSize - startHeap;
      const growthPct = startHeap > 0 ? (growthBytes / startHeap) * 100 : 0;
      memory = {
        startHeap,
        endHeap: endSnap.usedJSHeapSize,
        peakHeap,
        growthBytes,
        growthPct,
      };
    }

    const steps = stepsRef.current.map((step) => ({
      ...step,
      pct: (step.ms / safeTotalMs) * 100,
    }));

    const blocks = blocksRef.current.map((block) => ({
      ...block,
      pct: (block.ms / safeTotalMs) * 100,
    }));
    const largestBlock =
      blocks.length > 0
        ? blocks.reduce((largest, block) =>
            block.ms > largest.ms ? block : largest,
          )
        : null;

    const phases = PHASE_ORDER.map((phase) => {
      const ms = phaseTotalsRef.current[phase];
      const samples = phaseCountsRef.current[phase];
      return {
        key: phase,
        label: PHASE_LABELS[phase],
        ms,
        pct: (ms / safeTotalMs) * 100,
        samples,
        avgMs: samples > 0 ? ms / samples : 0,
      };
    });

    const baseline = loadBaseline();
    const baselineComparison = baseline
      ? compareToBaseline({ totalMs, fps, steps }, baseline)
      : null;

    const nextReport: TownPerfReport = {
      scenario: scenario.scenario,
      startedAt: scenario.startedAtIso,
      finishedAt,
      totalMs,
      fps,
      memory,
      longTasks,
      steps,
      blocks,
      largestBlock,
      phases,
      baselineComparison,
    };

    setReport(nextReport);
    scenarioRef.current = null;
    return nextReport;
  }, [stopFpsLoop, stopLongTaskObserver]);

  const measure = useCallback(
    <T>(phase: Exclude<TownPerfPhase, "frameWait">, fn: () => T): T => {
      if (!enabled || !recordingRef.current) return fn();
      const startedAtMs = performance.now();
      try {
        return fn();
      } finally {
        const ms = performance.now() - startedAtMs;
        if (ms > 0) {
          phaseTotalsRef.current[phase] += ms;
          phaseCountsRef.current[phase] += 1;
        }
      }
    },
    [enabled],
  );

  const scheduleFrameSample = useCallback(() => {
    if (!enabled || !recordingRef.current) return;
    frameStartRef.current = performance.now();
    if (frameTimerRef.current !== null) return;
    frameTimerRef.current = window.requestAnimationFrame((frameAt) => {
      frameTimerRef.current = null;
      const start = frameStartRef.current;
      if (start === null) return;
      const ms = Math.max(0, frameAt - start);
      phaseTotalsRef.current.frameWait += ms;
      phaseCountsRef.current.frameWait += 1;
    });
  }, [enabled]);

  const recordDuration = useCallback(
    (phase: TownPerfPhase, ms: number) => {
      if (!enabled || !recordingRef.current || ms <= 0) return;
      phaseTotalsRef.current[phase] += ms;
      phaseCountsRef.current[phase] += 1;
    },
    [enabled],
  );

  const saveCurrentAsBaseline = useCallback(() => {
    if (report) saveBaseline(report);
  }, [report]);

  const clearCurrentBaseline = useCallback(() => {
    clearBaseline();
  }, []);

  return useMemo(
    () => ({
      clearCurrentBaseline,
      clearReport,
      finishScenario,
      measure,
      recordDuration,
      report,
      runBlock,
      runStep,
      running,
      saveCurrentAsBaseline,
      scheduleFrameSample,
      startScenario,
    }),
    [
      clearCurrentBaseline,
      clearReport,
      finishScenario,
      measure,
      recordDuration,
      report,
      runBlock,
      runStep,
      running,
      saveCurrentAsBaseline,
      scheduleFrameSample,
      startScenario,
    ],
  );
}
