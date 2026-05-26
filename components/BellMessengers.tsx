"use client";

import { useMemo, useRef, useEffect } from "react";
import type { Stop } from "@/lib/town";
import { GENERATED_TOWN_LAYOUT } from "@/lib/town-layout";

type Phase = "running" | "done" | "error";

type Props = {
  stops: Stop[];
  phase: Phase;
};

type Messenger = {
  id: string;
  outboundPath: string;
  returnPath: string;
  pan: number;
};

const BELL = GENERATED_TOWN_LAYOUT.landmarks.bellTower;
const OUTBOUND_SECONDS = 2.2;
const RETURN_SECONDS = 1.6;
const MAX_RIPPLE_SECONDS = 1.2;
const MAX_AUDIO_WHOOSHES = 72;

function messengerRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
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
    outbound: `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx1} ${cy1}, ${to.x} ${to.y}`,
    inbound: `M ${to.x} ${to.y} C ${cx2} ${cy2}, ${cx2} ${cy2}, ${from.x} ${from.y}`,
  };
}

/**
 * Small glowing dots that fan out from the bell tower to every stop when the
 * bell is rung, then return after manifests are gathered.
 *
 * All animations use begin="indefinite" and are kicked off imperatively via
 * beginElementAt(delay) so timing is relative to mount, not document start.
 */
export function BellMessengers({ stops, phase }: Props) {
  const messengers = useMemo<Messenger[]>(
    () =>
      stops.map((stop) => {
        const route = messengerRoute(BELL, stop.position);
        return {
          id: `${stop.district}-${stop.id}`,
          outboundPath: route.outbound,
          returnPath: route.inbound,
          pan: Math.max(
            -0.85,
            Math.min(0.85, (stop.position.x - BELL.x) / 760),
          ),
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

  const containerRef = useRef<SVGGElement>(null);

  // Kick off all SMIL animations imperatively on mount / phase change.
  useEffect(() => {
    const g = containerRef.current;
    if (!g) return;
    const anims = g.querySelectorAll<
      SVGAnimateElement | SVGAnimateMotionElement
    >("animateMotion, animate");
    anims.forEach((anim) => {
      const delay = parseFloat(anim.getAttribute("data-delay") ?? "0");
      anim.beginElementAt(delay);
    });

    if (phase === "running" || phase === "done") {
      playMessengerWhooshes(messengers, phase, stagger);
    }
  }, [messengers, phase, stagger]);

  const isOutbound = phase === "running";
  const isReturn = phase === "done";
  if (!isOutbound && !isReturn) return null;

  const dur = isOutbound ? OUTBOUND_SECONDS : RETURN_SECONDS;
  const color = isOutbound ? "#e6c66a" : "#8cd4a0";
  const radius = isOutbound ? 3.5 : 3;

  return (
    <g
      ref={containerRef}
      key={phase}
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

      {messengers.map((m, i) => {
        const path = isOutbound ? m.outboundPath : m.returnPath;
        const delay = i * stagger;
        return (
          <circle
            key={m.id}
            r={radius}
            fill={color}
            opacity={0}
            filter="url(#bell-messenger-glow)"
          >
            <animateMotion
              dur={`${dur}s`}
              begin="indefinite"
              data-delay={delay.toFixed(3)}
              repeatCount="1"
              fill="freeze"
              path={path}
              calcMode="spline"
              keyTimes="0;1"
              keySplines="0.25 0.1 0.25 1"
            />
            <animate
              attributeName="opacity"
              values={isOutbound ? "0;0.9;0.9;0" : "0;0.85;0.85;0"}
              keyTimes={isOutbound ? "0;0.06;0.82;1" : "0;0.08;0.78;1"}
              dur={`${dur}s`}
              begin="indefinite"
              data-delay={delay.toFixed(3)}
              repeatCount="1"
              fill="freeze"
              calcMode="linear"
            />
          </circle>
        );
      })}
    </g>
  );
}

function playMessengerWhooshes(
  messengers: Messenger[],
  phase: Phase,
  stagger: number,
) {
  if (typeof window === "undefined") return;

  try {
    type AudioCtxCtor = typeof AudioContext;
    const Ctor: AudioCtxCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: AudioCtxCtor })
        .webkitAudioContext;
    const ctx = new Ctor();
    void ctx.resume();

    const isOutbound = phase === "running";
    const duration = isOutbound ? OUTBOUND_SECONDS : RETURN_SECONDS;
    const now = ctx.currentTime + 0.02;
    const stride = Math.max(
      1,
      Math.ceil(messengers.length / MAX_AUDIO_WHOOSHES),
    );
    const audibleMessengers = messengers.filter(
      (_, index) => index % stride === 0,
    );
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.85, now);
    master.gain.linearRampToValueAtTime(0.65, now + duration * 0.5);
    master.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration + MAX_RIPPLE_SECONDS + 0.5,
    );
    master.connect(ctx.destination);

    scheduleMessengerBed(
      ctx,
      master,
      now,
      duration + MAX_RIPPLE_SECONDS,
      isOutbound,
    );

    audibleMessengers.forEach((messenger, index) => {
      const originalIndex = index * stride;
      const delay = originalIndex * stagger;
      const tone = originalIndex % 5;
      scheduleMessengerWhoosh(ctx, master, {
        time: now + delay,
        duration: isOutbound ? 2.8 : 2.2,
        gain: isOutbound ? 0.09 : 0.065,
        pan: isOutbound ? messenger.pan : -messenger.pan * 0.6,
        highpass: isOutbound ? 180 + tone * 20 : 140 + tone * 16,
        bandpass: isOutbound ? 800 + tone * 90 : 600 + tone * 70,
      });
    });

    window.setTimeout(
      () => {
        void ctx.close();
      },
      (duration + MAX_RIPPLE_SECONDS + 0.8) * 1000,
    );
  } catch {
    // audio not available — silent fail
  }
}

function scheduleMessengerBed(
  ctx: AudioContext,
  destination: AudioNode,
  time: number,
  duration: number,
  isOutbound: boolean,
) {
  const source = ctx.createBufferSource();
  const hush = ctx.createBiquadFilter();
  const air = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = makeNoiseBuffer(ctx, duration, (progress) => {
    const attack = Math.min(1, progress / 0.18);
    const release = Math.min(1, (1 - progress) / 0.34);
    const pulse = 0.55 + Math.sin(progress * Math.PI * 8) * 0.16;
    return Math.max(0, Math.min(1, attack, release)) * pulse;
  });

  hush.type = "lowpass";
  hush.frequency.setValueAtTime(isOutbound ? 4300 : 3300, time);
  hush.Q.setValueAtTime(0.35, time);
  air.type = "bandpass";
  air.frequency.setValueAtTime(isOutbound ? 1050 : 860, time);
  air.Q.setValueAtTime(0.52, time);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(isOutbound ? 0.08 : 0.06, time + 0.2);
  gain.gain.linearRampToValueAtTime(
    isOutbound ? 0.055 : 0.04,
    time + duration * 0.62,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  source.connect(hush);
  hush.connect(air);
  air.connect(gain);
  gain.connect(destination);
  source.start(time);
  source.stop(time + duration);
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

  // --- Noise layer: shaped white noise for the "air rush" ---
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = makeNoiseBuffer(ctx, dur, (progress) => {
    // Swell up, peak at ~40%, then trail off
    const attack = Math.min(1, progress / 0.15);
    const peak = 1 - Math.abs(progress - 0.4) * 1.2;
    const release = Math.pow(Math.max(0, 1 - progress), 1.2);
    return Math.max(0, Math.min(1, attack, peak + 0.3)) * release;
  });

  // Doppler sweep: bandpass sweeps high→low as the particle "passes"
  const doppler = ctx.createBiquadFilter();
  doppler.type = "bandpass";
  doppler.Q.setValueAtTime(1.2, t);
  doppler.frequency.setValueAtTime(options.bandpass * 1.8, t);
  doppler.frequency.exponentialRampToValueAtTime(
    Math.max(80, options.bandpass * 0.25),
    t + dur,
  );

  // --- Sub-bass oscillator: gives the "thump" ---
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(65 + (options.highpass % 20), t);
  sub.frequency.exponentialRampToValueAtTime(35, t + dur);
  subGain.gain.setValueAtTime(0.0001, t);
  subGain.gain.linearRampToValueAtTime(options.gain * 2.5, t + 0.12);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);

  // --- Noise gain envelope ---
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.linearRampToValueAtTime(options.gain * 1.6, t + 0.1);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  // --- Stereo panning ---
  const panner =
    typeof ctx.createStereoPanner === "function"
      ? ctx.createStereoPanner()
      : null;

  // Wire noise path
  noiseSource.connect(doppler);
  if (panner) {
    panner.pan.setValueAtTime(options.pan, t);
    doppler.connect(panner);
    panner.connect(noiseGain);
  } else {
    doppler.connect(noiseGain);
  }
  noiseGain.connect(destination);

  // Wire sub-bass path (no panning — bass stays centered)
  sub.connect(subGain);
  subGain.connect(destination);

  noiseSource.start(t);
  noiseSource.stop(t + dur);
  sub.start(t);
  sub.stop(t + dur);
}

function makeNoiseBuffer(
  ctx: AudioContext,
  duration: number,
  envelope: (progress: number) => number,
) {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    previous = previous * 0.78 + (Math.random() * 2 - 1) * 0.22;
    channel[index] = previous * envelope(progress) * 0.58;
  }

  return buffer;
}
