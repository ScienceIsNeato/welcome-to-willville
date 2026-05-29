"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Stop } from "@/lib/town";
import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";
import { makeNoiseBuffer } from "@/lib/audio-noise";

type Phase = "running" | "done" | "error";

type Props = {
  stops: Stop[];
  phase: Phase;
  startedAt: number | null;
  completedAtByStopId: Record<string, number>;
};

/**
 * Pre-attentive health verdict for a stop, ordered by how loudly it should
 * shout for attention. This rides the most instinctive visual channel (color).
 */
type Health = "attention" | "running" | "healthy" | "dormant";

type Point = {
  x: number;
  y: number;
};

type Curve = {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
};

type Messenger = {
  stopId: string;
  outboundCurve: Curve;
  returnCurve: Curve;
  pan: number;
  orbitRadiusX: number;
  orbitRadiusY: number;
  orbitPhase: number;
  target: Point;
  /** Health verdict -> core particle color (the headline signal). */
  health: Health;
  /** Commit velocity -> particle size + glow (1 = average, >1 = busy). */
  radiusScale: number;
  /** Recency of last commit -> how fast the messenger rides home. */
  returnSeconds: number;
  /** Explicitly blocked -> messenger struggles to leave (tight, anxious orbit). */
  blocked: boolean;
  /** Open PR count -> length of the comet tail it drags home. */
  prSparks: number;
  /** Repo importance (stars / priority) -> brighter chime pitch (0–4). */
  importance: number;
};

type ActiveParticle = {
  key: string;
  x: number;
  y: number;
  color: string;
  radius: number;
  opacity: number;
};

type BellAudioSession = {
  ctx: AudioContext;
  master: GainNode;
  completedStopIds: Set<string>;
  stopBed: () => void;
};

const BELL = GENERATED_TOWN_LAYOUT.landmarks.bellTower;
const OUTBOUND_SECONDS = 2.2;
const RETURN_SECONDS = 1.6;
const RETURN_MIN_DELAY = 1.5; // min seconds orbiting before returning
const MAX_RIPPLE_SECONDS = 1.2;
const MAX_AUDIO_WHOOSHES = 72;
const ORBIT_SPEED = 2.9;
const THRUM_PULSE_HZ = 4.5;
// How much longer a blocked repo lingers in its anxious orbit before it can
// finally limp home. Blockers become something you literally watch struggle.
const BLOCKED_ORBIT_BONUS = 1.1;
// Each open PR adds one trailing spark; cap the tail so a backlog-heavy repo
// stays a comet, not a smear.
const MAX_PR_SPARKS = 5;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

// Health -> core particle color. Color is the loudest channel, so it answers
// the single most important question: is this repo OK right now?
const HEALTH_COLOR: Record<Health, string> = {
  attention: "#ff5a52", // red — CI failing or explicitly blocked
  running: "#e6c66a", // gold — active work in progress
  healthy: "#58c97a", // green — shipping / passing / cruising
  dormant: "#8a8a8a", // grey — quiet or no manifest
};

function messengerRoute(from: Point, to: Point) {
  const mid = {
    x: Math.round((from.x + to.x) / 2),
    y: Math.round((from.y + to.y) / 2),
  };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(100, Math.max(30, distance * 0.15));
  const nx = -dy / distance;
  const ny = dx / distance;
  const cx1 = Math.round(mid.x + nx * bend);
  const cy1 = Math.round(mid.y + ny * bend);
  const cx2 = Math.round(mid.x - nx * bend * 0.7);
  const cy2 = Math.round(mid.y - ny * bend * 0.7);

  return {
    outbound: {
      p0: from,
      p1: { x: cx1, y: cy1 },
      p2: { x: cx1, y: cy1 },
      p3: to,
    },
    inbound: {
      p0: to,
      p1: { x: cx2, y: cy2 },
      p2: { x: cx2, y: cy2 },
      p3: from,
    },
  };
}

/**
 * Small glowing dots that fan out from the bell tower to every stop when the
 * bell is rung. While manifests are still in flight, each messenger orbits its
 * site and keeps thrumming until that specific site completes, then rides home
 * carrying a status report: its color is the repo's health, its size is the
 * repo's commit velocity, and its speed home is how recently the repo shipped.
 */
export function BellMessengers({
  stops,
  phase,
  startedAt,
  completedAtByStopId,
}: Props) {
  const messengers = useMemo<Messenger[]>(
    () =>
      stops.map((stop, index) => {
        const route = messengerRoute(BELL, stop.position);
        const hasManifest = stopHasManifest(stop);
        return {
          stopId: stop.id,
          outboundCurve: route.outbound,
          returnCurve: route.inbound,
          pan: Math.max(
            -0.85,
            Math.min(0.85, (stop.position.x - BELL.x) / 760),
          ),
          orbitRadiusX: 10 + (index % 3) * 2,
          orbitRadiusY: 8 + (index % 4) * 1.5,
          orbitPhase: index * 0.72,
          target: stop.position,
          health: stopHealth(stop, hasManifest),
          radiusScale: velocityRadiusScale(stop.commits7d),
          returnSeconds: recencyReturnSeconds(stop.lastCommitAt),
          blocked: hasManifest && !!stop.status.blocked,
          prSparks: Math.min(MAX_PR_SPARKS, Math.max(0, stop.openPrCount ?? 0)),
          importance: importanceTone(stop),
        };
      }),
    [stops],
  );

  const stagger = useMemo(
    () =>
      messengers.length > 1
        ? Math.min(MAX_RIPPLE_SECONDS / (messengers.length - 1), 0.06)
        : 0,
    [messengers.length],
  );

  const [frameTime, setFrameTime] = useState(0);
  const audioRef = useRef<BellAudioSession | null>(null);
  const animationEndTime = useMemo(() => {
    if (phase !== "done" || startedAt === null) {
      return null;
    }

    const lastArrivalSeconds = messengers.reduce((latest, messenger, index) => {
      const outboundStart = index * stagger;
      const outboundEnd = outboundStart + OUTBOUND_SECONDS;
      const completedAt = completedAtByStopId[messenger.stopId];
      const returnStart = returnStartSeconds({
        completedAt,
        startedAt,
        outboundEnd,
      });
      return Math.max(latest, returnStart + messenger.returnSeconds);
    }, 0);

    return startedAt + lastArrivalSeconds * 1000;
  }, [completedAtByStopId, messengers, phase, stagger, startedAt]);

  useEffect(() => {
    if ((phase !== "running" && phase !== "done") || startedAt === null) {
      return;
    }

    let raf = 0;
    const tick = (timestamp: number) => {
      setFrameTime(timestamp);
      if (animationEndTime !== null && timestamp >= animationEndTime) {
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [animationEndTime, phase, startedAt]);

  useEffect(() => {
    if (phase !== "running" || startedAt === null || messengers.length === 0) {
      return;
    }

    if (audioRef.current) {
      return;
    }

    audioRef.current = createBellAudioSession(messengers, stagger);
  }, [messengers, phase, stagger, startedAt]);

  useEffect(() => {
    const session = audioRef.current;
    if (!session) {
      return;
    }

    messengers.forEach((messenger) => {
      if (
        completedAtByStopId[messenger.stopId] === undefined ||
        session.completedStopIds.has(messenger.stopId)
      ) {
        return;
      }

      session.completedStopIds.add(messenger.stopId);
      const tone = messenger.importance;
      scheduleMessengerWhoosh(session.ctx, session.master, {
        time: session.ctx.currentTime + 0.02,
        duration: 2.2,
        gain: 0.065,
        pan: -messenger.pan * 0.6,
        highpass: 140 + tone * 16,
        bandpass: 600 + tone * 70,
      });
    });
  }, [completedAtByStopId, messengers]);

  useEffect(() => {
    if (phase !== "error") {
      return;
    }

    stopBellAudioSession(audioRef.current);
    audioRef.current = null;
  }, [phase]);

  useEffect(() => {
    if (phase !== "done" || animationEndTime === null) {
      return;
    }

    const remaining = Math.max(0, animationEndTime - performance.now());
    const timer = window.setTimeout(() => {
      stopBellAudioSession(audioRef.current);
      audioRef.current = null;
    }, remaining);

    return () => {
      window.clearTimeout(timer);
    };
  }, [animationEndTime, phase]);

  useEffect(
    () => () => {
      stopBellAudioSession(audioRef.current);
      audioRef.current = null;
    },
    [],
  );

  const activeParticles = useMemo(() => {
    if (phase === "error" || startedAt === null) {
      return [];
    }

    const elapsed = Math.max(0, (frameTime - startedAt) / 1000);
    return messengers.flatMap((messenger, index) =>
      particleForMessenger({
        messenger,
        index,
        stagger,
        elapsed,
        startedAt,
        completedAt: completedAtByStopId[messenger.stopId],
      }),
    );
  }, [completedAtByStopId, frameTime, messengers, phase, stagger, startedAt]);

  if (phase === "error" || activeParticles.length === 0) {
    return null;
  }

  return (
    <g
      id="bell-messengers"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <filter
          id="bell-messenger-glow"
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {activeParticles.map((particle) => (
        <g
          key={particle.key}
          transform={`translate(${particle.x} ${particle.y})`}
          filter="url(#bell-messenger-glow)"
        >
          <circle
            r={particle.radius * 1.95}
            fill={particle.color}
            opacity={particle.opacity * 0.16}
          />
          <circle
            r={particle.radius}
            fill={particle.color}
            opacity={particle.opacity}
          />
        </g>
      ))}
    </g>
  );
}

function particleForMessenger(options: {
  messenger: Messenger;
  index: number;
  stagger: number;
  elapsed: number;
  startedAt: number;
  completedAt: number | undefined;
}): ActiveParticle[] {
  const { messenger, index, stagger, elapsed, startedAt, completedAt } =
    options;
  const outboundStart = index * stagger;
  const outboundEnd = outboundStart + OUTBOUND_SECONDS;

  if (elapsed < outboundStart) {
    return [];
  }

  if (elapsed < outboundEnd) {
    const progress = easeTravel((elapsed - outboundStart) / OUTBOUND_SECONDS);
    const point = pointOnCurve(messenger.outboundCurve, progress);
    const opacity =
      progress < 0.08
        ? progress / 0.08
        : progress > 0.82
          ? Math.max(0.34, 1 - (progress - 0.82) / 0.18)
          : 1;
    return [
      {
        key: messenger.stopId,
        x: point.x,
        y: point.y,
        color: "#e6c66a",
        radius: 3.5 * messenger.radiusScale,
        opacity,
      },
    ];
  }

  const returnStart =
    returnStartSeconds({ completedAt, startedAt, outboundEnd }) +
    (messenger.blocked ? BLOCKED_ORBIT_BONUS : 0);

  if (elapsed < returnStart) {
    return [orbitParticle(messenger, elapsed - outboundEnd)];
  }

  if (elapsed < returnStart + messenger.returnSeconds) {
    const progress = easeTravel(
      (elapsed - returnStart) / messenger.returnSeconds,
    );
    return returnParticles(messenger, progress);
  }

  return [];
}

/**
 * The orbiting "in flight" particle. Blocked repos can't settle: their orbit
 * tightens, speeds up, jitters anxiously, and flushes red \u2014 you watch the
 * blocker struggle before it finally limps home.
 */
function orbitParticle(
  messenger: Messenger,
  orbitElapsed: number,
): ActiveParticle {
  const speed = messenger.blocked ? ORBIT_SPEED * 1.7 : ORBIT_SPEED;
  const angle = orbitElapsed * speed * Math.PI * 2 + messenger.orbitPhase;
  const pulse =
    0.76 + Math.sin(orbitElapsed * THRUM_PULSE_HZ * Math.PI * 2) * 0.18;
  const radiusX = messenger.orbitRadiusX * (messenger.blocked ? 0.55 : 1);
  const radiusY = messenger.orbitRadiusY * (messenger.blocked ? 0.55 : 1);
  const jitterX = messenger.blocked ? Math.sin(orbitElapsed * 37) * 1.7 : 0;
  const jitterY = messenger.blocked ? Math.cos(orbitElapsed * 41) * 1.7 : 0;
  return {
    key: messenger.stopId,
    x: messenger.target.x + Math.cos(angle) * radiusX + jitterX,
    y: messenger.target.y + Math.sin(angle) * radiusY + jitterY,
    color: messenger.blocked ? HEALTH_COLOR.attention : "#e6c66a",
    radius: (2.8 + pulse * 0.9) * messenger.radiusScale,
    opacity: 0.72 + (pulse - 0.58) * 0.34,
  };
}

/**
 * The homebound messenger plus a comet tail of trailing sparks — one per open
 * PR — so a repo dragging a backlog visibly hauls more work home.
 */
function returnParticles(
  messenger: Messenger,
  progress: number,
): ActiveParticle[] {
  const point = pointOnCurve(messenger.returnCurve, progress);
  const baseRadius = 3 * messenger.radiusScale;
  const baseOpacity = Math.max(0.35, 1 - progress * 0.5);
  const particles: ActiveParticle[] = [
    {
      key: messenger.stopId,
      x: point.x,
      y: point.y,
      color: HEALTH_COLOR[messenger.health],
      radius: baseRadius,
      opacity: baseOpacity,
    },
  ];
  for (let spark = 1; spark <= messenger.prSparks; spark += 1) {
    const trailT = Math.max(0, progress - spark * 0.05);
    const tp = pointOnCurve(messenger.returnCurve, trailT);
    particles.push({
      key: `${messenger.stopId}-pr-${spark}`,
      x: tp.x,
      y: tp.y,
      color: HEALTH_COLOR[messenger.health],
      radius: Math.max(0.8, baseRadius * (1 - spark * 0.16)),
      opacity: Math.max(0.1, baseOpacity * (1 - spark * 0.18)),
    });
  }
  return particles;
}

function returnStartSeconds(options: {
  completedAt: number | undefined;
  startedAt: number;
  outboundEnd: number;
}): number {
  const { completedAt, startedAt, outboundEnd } = options;
  const earliestReturn = outboundEnd + RETURN_MIN_DELAY;
  if (completedAt === undefined) {
    return earliestReturn;
  }
  const resolvedAtSeconds = Math.max(0, (completedAt - startedAt) / 1000);
  return Math.max(resolvedAtSeconds, earliestReturn);
}

function pointOnCurve(curve: Curve, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x:
      uuu * curve.p0.x +
      3 * uu * t * curve.p1.x +
      3 * u * tt * curve.p2.x +
      ttt * curve.p3.x,
    y:
      uuu * curve.p0.y +
      3 * uu * t * curve.p1.y +
      3 * u * tt * curve.p2.y +
      ttt * curve.p3.y,
  };
}

/**
 * Whether a stop has a real Willville manifest behind it (vs. a default/empty
 * placeholder). No manifest means the messenger rides home grey/dormant.
 */
function stopHasManifest(stop: Stop): boolean {
  return !!(
    stop.status.doing ||
    stop.status.next ||
    (stop.status.state && stop.status.state !== "unknown")
  );
}

/**
 * Reduce a stop down to a single pre-attentive health verdict. CI is the
 * freshest hard signal, so it wins; then explicit blockers; then the
 * repo-authored lifecycle state.
 */
function stopHealth(stop: Stop, hasManifest = stopHasManifest(stop)): Health {
  if (!hasManifest) return "dormant";
  const latestRun = stop.workflowRuns?.[0]?.status;
  if (latestRun === "failed" || stop.status.blocked) return "attention";
  if (latestRun === "running") return "running";
  switch (stop.status.state) {
    case "shipping":
    case "maintenance":
      return "healthy";
    case "wip":
    case "idea":
      return "running";
    case "dormant":
      return "dormant";
    default:
      return latestRun === "success" ? "healthy" : "dormant";
  }
}

/**
 * Tally the town's health for the bell's closing banner. Turns the swarm of
 * messengers into a one-line verdict: how many repos are happy, busy, or need
 * a human.
 */
export function summarizeTownHealth(stops: Stop[]): Record<Health, number> {
  const tally: Record<Health, number> = {
    attention: 0,
    running: 0,
    healthy: 0,
    dormant: 0,
  };
  for (const stop of stops) {
    tally[stopHealth(stop)] += 1;
  }
  return tally;
}

/**
 * Commit velocity -> particle size multiplier. Busy repos (lots of commits in
 * the last week) send fatter, brighter messengers; quiet ones send faint motes.
 */
function velocityRadiusScale(commits7d: number | undefined): number {
  const velocity = commits7d ?? 0;
  const intensity = Math.max(0, Math.min(1, velocity / 30));
  return 0.85 + intensity * 0.9;
}

/**
 * Recency of the last commit -> how fast the messenger rides home. Fresh repos
 * zip back; stale ones drift home slow and tired. Recency becomes kinetic
 * instead of a color you have to decode.
 */
function recencyReturnSeconds(lastCommitAt: string | undefined): number {
  if (!lastCommitAt) return RETURN_SECONDS * 1.4;
  const age = Date.now() - Date.parse(lastCommitAt);
  if (Number.isNaN(age)) return RETURN_SECONDS * 1.4;
  if (age < DAY_MS) return RETURN_SECONDS * 0.72;
  if (age < WEEK_MS) return RETURN_SECONDS;
  if (age < 4 * WEEK_MS) return RETURN_SECONDS * 1.25;
  return RETURN_SECONDS * 1.5;
}

/**
 * Repo importance -> chime pitch bucket (0–4). Stars set the floor; an active,
 * high-priority queue bumps it up. Higher importance rings a brighter note, so
 * the whole town's chord means something instead of being random.
 */
function importanceTone(stop: Stop): number {
  const stars = stop.stars ?? 0;
  let score = 0;
  if (stars >= 20) score = 4;
  else if (stars >= 8) score = 3;
  else if (stars >= 3) score = 2;
  else if (stars >= 1) score = 1;
  if (stop.queue?.active && (stop.queue.priority ?? 99) <= 1) {
    score = Math.min(4, score + 1);
  }
  return score;
}

function easeTravel(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return 1 - Math.pow(1 - clamped, 3);
}

function createBellAudioSession(
  messengers: Messenger[],
  stagger: number,
): BellAudioSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    type AudioCtxCtor = typeof AudioContext;
    const Ctor: AudioCtxCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: AudioCtxCtor })
        .webkitAudioContext;
    const ctx = new Ctor();
    void ctx.resume();

    const now = ctx.currentTime + 0.02;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.84, now + 0.12);
    master.connect(ctx.destination);

    const stopBed = startOrbitThrumBed(ctx, master, now);
    const stride = Math.max(
      1,
      Math.ceil(messengers.length / MAX_AUDIO_WHOOSHES),
    );
    messengers.forEach((messenger, index) => {
      if (index % stride !== 0) {
        return;
      }

      const tone = messenger.importance;
      scheduleMessengerWhoosh(ctx, master, {
        time: now + index * stagger,
        duration: 2.8,
        gain: 0.09,
        pan: messenger.pan,
        highpass: 180 + tone * 20,
        bandpass: 800 + tone * 90,
      });
    });

    return {
      ctx,
      master,
      completedStopIds: new Set<string>(),
      stopBed,
    };
  } catch {
    return null;
  }
}

function stopBellAudioSession(session: BellAudioSession | null) {
  if (!session || typeof window === "undefined") {
    return;
  }

  const stopAt = session.ctx.currentTime + 0.02;
  session.stopBed();
  session.master.gain.cancelScheduledValues(stopAt);
  session.master.gain.setValueAtTime(
    Math.max(session.master.gain.value, 0.0001),
    stopAt,
  );
  session.master.gain.exponentialRampToValueAtTime(0.0001, stopAt + 0.45);
  window.setTimeout(() => {
    void session.ctx.close();
  }, 900);
}

function startOrbitThrumBed(
  ctx: AudioContext,
  destination: AudioNode,
  time: number,
) {
  const bed = ctx.createGain();
  bed.gain.setValueAtTime(0.0001, time);
  bed.gain.linearRampToValueAtTime(0.12, time + 0.18);
  bed.connect(destination);

  const low = ctx.createOscillator();
  const lowGain = ctx.createGain();
  low.type = "triangle";
  low.frequency.setValueAtTime(102, time);
  lowGain.gain.setValueAtTime(0.04, time);

  const high = ctx.createOscillator();
  const highGain = ctx.createGain();
  high.type = "sine";
  high.frequency.setValueAtTime(204, time);
  highGain.gain.setValueAtTime(0.018, time);

  const pulse = ctx.createOscillator();
  const pulseDepth = ctx.createGain();
  pulse.type = "sine";
  pulse.frequency.setValueAtTime(THRUM_PULSE_HZ, time);
  pulseDepth.gain.setValueAtTime(0.012, time);

  const shimmer = ctx.createBufferSource();
  shimmer.buffer = makeNoiseBuffer(ctx, 2.4, () => 1, {
    smoothing: 0.9,
    randomWeight: 0.1,
    level: 0.2,
  });
  shimmer.loop = true;

  const shimmerFilter = ctx.createBiquadFilter();
  shimmerFilter.type = "bandpass";
  shimmerFilter.frequency.setValueAtTime(980, time);
  shimmerFilter.Q.setValueAtTime(0.6, time);

  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0.024, time);

  pulse.connect(pulseDepth);
  pulseDepth.connect(lowGain.gain);
  pulseDepth.connect(highGain.gain);
  low.connect(lowGain);
  high.connect(highGain);
  shimmer.connect(shimmerFilter);
  shimmerFilter.connect(shimmerGain);
  lowGain.connect(bed);
  highGain.connect(bed);
  shimmerGain.connect(bed);

  low.start(time);
  high.start(time);
  pulse.start(time);
  shimmer.start(time);

  return () => {
    const stopAt = ctx.currentTime + 0.02;
    bed.gain.cancelScheduledValues(stopAt);
    bed.gain.setValueAtTime(Math.max(bed.gain.value, 0.0001), stopAt);
    bed.gain.exponentialRampToValueAtTime(0.0001, stopAt + 0.3);
    low.stop(stopAt + 0.35);
    high.stop(stopAt + 0.35);
    pulse.stop(stopAt + 0.35);
    shimmer.stop(stopAt + 0.35);
  };
}

function scheduleMessengerWhoosh(
  ctx: AudioContext,
  destination: AudioNode,
  options: {
    time: number;
    duration: number;
    gain: number;
    pan: number;
    highpass: number;
    bandpass: number;
  },
) {
  const dur = options.duration;
  const t = options.time;

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = makeNoiseBuffer(
    ctx,
    dur,
    (progress) => {
      const attack = Math.min(1, progress / 0.15);
      const peak = 1 - Math.abs(progress - 0.4) * 1.2;
      const release = Math.pow(Math.max(0, 1 - progress), 1.2);
      return Math.max(0, Math.min(1, attack, peak + 0.3)) * release;
    },
    { smoothing: 0.78, randomWeight: 0.22, level: 0.58 },
  );

  const doppler = ctx.createBiquadFilter();
  doppler.type = "bandpass";
  doppler.Q.setValueAtTime(1.2, t);
  doppler.frequency.setValueAtTime(options.bandpass * 1.8, t);
  doppler.frequency.exponentialRampToValueAtTime(
    Math.max(80, options.bandpass * 0.25),
    t + dur,
  );

  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(65 + (options.highpass % 20), t);
  sub.frequency.exponentialRampToValueAtTime(35, t + dur);
  subGain.gain.setValueAtTime(0.0001, t);
  subGain.gain.linearRampToValueAtTime(options.gain * 2.5, t + 0.12);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.linearRampToValueAtTime(options.gain * 1.6, t + 0.1);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const panner =
    typeof ctx.createStereoPanner === "function"
      ? ctx.createStereoPanner()
      : null;

  noiseSource.connect(doppler);
  if (panner) {
    panner.pan.setValueAtTime(options.pan, t);
    doppler.connect(panner);
    panner.connect(noiseGain);
  } else {
    doppler.connect(noiseGain);
  }
  noiseGain.connect(destination);

  sub.connect(subGain);
  subGain.connect(destination);

  noiseSource.start(t);
  noiseSource.stop(t + dur);
  sub.start(t);
  sub.stop(t + dur);
}
