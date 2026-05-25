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

export type TownPerfReportStep = {
  id: string;
  label: string;
  ms: number;
  pct: number;
};

type TownPerfReportPhase = {
  key: TownPerfPhase;
  label: string;
  ms: number;
  pct: number;
  samples: number;
  avgMs: number;
};

export type TownPerfReport = {
  scenario: string;
  startedAt: string;
  finishedAt: string;
  totalMs: number;
  steps: TownPerfReportStep[];
  phases: TownPerfReportPhase[];
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

export function useTownInteractionProfiler(enabled: boolean) {
  const scenarioRef = useRef<ScenarioMeta | null>(null);
  const phaseTotalsRef =
    useRef<Record<TownPerfPhase, number>>(emptyPhaseTotals());
  const phaseCountsRef =
    useRef<Record<TownPerfPhase, number>>(emptyPhaseCounts());
  const frameStartRef = useRef<number | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const stepsRef = useRef<TownPerfReportStep[]>([]);
  const recordingRef = useRef(false);
  const [report, setReport] = useState<TownPerfReport | null>(null);
  const [running, setRunning] = useState(false);

  const resetAccumulators = useCallback(() => {
    phaseTotalsRef.current = emptyPhaseTotals();
    phaseCountsRef.current = emptyPhaseCounts();
    stepsRef.current = [];
    frameStartRef.current = null;
    if (frameTimerRef.current !== null) {
      window.cancelAnimationFrame(frameTimerRef.current);
      frameTimerRef.current = null;
    }
  }, []);

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
      setRunning(true);
      setReport(null);
    },
    [resetAccumulators],
  );

  const runStep = useCallback(
    async <T>(id: string, label: string, fn: () => Promise<T> | T) => {
      const startedAtMs = performance.now();
      const result = await fn();
      const ms = performance.now() - startedAtMs;
      stepsRef.current.push({
        id,
        label,
        ms,
        pct: 0,
      });
      return result;
    },
    [],
  );

  const finishScenario = useCallback(() => {
    const scenario = scenarioRef.current;
    if (!scenario) return null;

    recordingRef.current = false;
    setRunning(false);

    const finishedAt = new Date().toISOString();
    const totalMs = performance.now() - scenario.startedAtMs;
    const safeTotalMs = Math.max(totalMs, 0.0001);

    const steps = stepsRef.current.map((step) => ({
      ...step,
      pct: (step.ms / safeTotalMs) * 100,
    }));

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

    const nextReport: TownPerfReport = {
      scenario: scenario.scenario,
      startedAt: scenario.startedAtIso,
      finishedAt,
      totalMs,
      steps,
      phases,
    };

    setReport(nextReport);
    scenarioRef.current = null;
    return nextReport;
  }, []);

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

  return useMemo(
    () => ({
      clearReport,
      finishScenario,
      measure,
      recordDuration,
      report,
      runStep,
      running,
      scheduleFrameSample,
      startScenario,
    }),
    [
      clearReport,
      finishScenario,
      measure,
      recordDuration,
      report,
      runStep,
      running,
      scheduleFrameSample,
      startScenario,
    ],
  );
}
