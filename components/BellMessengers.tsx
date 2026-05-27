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
const MAX_RIPPLE_SECONDS = 1.2;
const MAX_AUDIO_WHOOSHES = 72;
const ORBIT_SPEED = 2.9;
const THRUM_PULSE_HZ = 4.5;

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
 * site and keeps thrumming until that specific site completes, then it turns
 * green and rides home.
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
      return Math.max(latest, returnStart + RETURN_SECONDS);
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

    messengers.forEach((messenger, index) => {
      if (
        completedAtByStopId[messenger.stopId] === undefined ||
        session.completedStopIds.has(messenger.stopId)
      ) {
        return;
      }

      session.completedStopIds.add(messenger.stopId);
      const tone = index % 5;
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
    return messengers
      .map((messenger, index) =>
        particleForMessenger({
          messenger,
          index,
          stagger,
          elapsed,
          startedAt,
          completedAt: completedAtByStopId[messenger.stopId],
        }),
      )
      .filter((particle): particle is ActiveParticle => particle !== null);
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
}): ActiveParticle | null {
  const { messenger, index, stagger, elapsed, startedAt, completedAt } =
    options;
  const outboundStart = index * stagger;
  const outboundEnd = outboundStart + OUTBOUND_SECONDS;

  if (elapsed < outboundStart) {
    return null;
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
    return {
      key: messenger.stopId,
      x: point.x,
      y: point.y,
      color: "#e6c66a",
      radius: 3.5,
      opacity,
    };
  }

  const returnStart = returnStartSeconds({
    completedAt,
    startedAt,
    outboundEnd,
  });

  if (elapsed < returnStart) {
    const orbitElapsed = elapsed - outboundEnd;
    const angle =
      orbitElapsed * ORBIT_SPEED * Math.PI * 2 + messenger.orbitPhase;
    const pulse =
      0.76 + Math.sin(orbitElapsed * THRUM_PULSE_HZ * Math.PI * 2) * 0.18;
    return {
      key: messenger.stopId,
      x: messenger.target.x + Math.cos(angle) * messenger.orbitRadiusX,
      y: messenger.target.y + Math.sin(angle) * messenger.orbitRadiusY,
      color: "#e6c66a",
      radius: 2.8 + pulse * 0.9,
      opacity: 0.72 + (pulse - 0.58) * 0.34,
    };
  }

  if (elapsed < returnStart + RETURN_SECONDS) {
    const progress = easeTravel((elapsed - returnStart) / RETURN_SECONDS);
    const point = pointOnCurve(messenger.returnCurve, progress);
    return {
      key: messenger.stopId,
      x: point.x,
      y: point.y,
      color: "#8cd4a0",
      radius: 3,
      opacity: Math.max(0.35, 1 - progress * 0.5),
    };
  }

  return null;
}

function returnStartSeconds(options: {
  completedAt: number | undefined;
  startedAt: number;
  outboundEnd: number;
}): number {
  const { completedAt, startedAt, outboundEnd } = options;
  const resolvedAtSeconds =
    completedAt === undefined
      ? outboundEnd
      : Math.max(0, (completedAt - startedAt) / 1000);
  return Math.max(resolvedAtSeconds, outboundEnd);
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

      const tone = index % 5;
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
