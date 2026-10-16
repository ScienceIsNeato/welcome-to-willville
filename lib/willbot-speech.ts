"use client";

/**
 * Willbot speech bus — plays Will's voice and drives the leviathan's mouth.
 *
 * The chat panel (components/WillbotChatPanel.tsx) receives base64 WAV audio
 * and a viseme timeline from /api/willbot and hands them here; the leviathan
 * (components/Leviathan.tsx) subscribes to mouth updates. A singleton keeps
 * the two decoupled — they sit far apart in the component tree.
 *
 * Visemes arrive as [[seconds, shape], ...] with Rhubarb-style shapes
 * (AI, E, O, U, etc, MBP, FV, L, WQ, rest). Playback drives a rAF loop off
 * the audio element's currentTime, so pauses and tab throttling stay in sync.
 */

export type VisemeFrame = [number, string];

type MouthListener = (shape: string, speaking: boolean) => void;

const listeners = new Set<MouthListener>();

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let rafId: number | null = null;

function emit(shape: string, speaking: boolean) {
  for (const l of listeners) l(shape, speaking);
}

/** Subscribe to mouth updates; returns an unsubscribe function. */
export function onWillbotMouth(listener: MouthListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stop any current speech and rest the mouth. */
export function stopWillbotSpeech(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  emit("rest", false);
}

/**
 * Play a reply: decode the WAV, start playback, and walk the viseme timeline
 * against audio.currentTime. Any previous speech is cut off first — the
 * leviathan has one mouth.
 */
export async function speakWillbotReply(
  audioWavB64: string,
  visemes: VisemeFrame[] | null | undefined,
): Promise<void> {
  stopWillbotSpeech();

  let url: string;
  try {
    const bytes = Uint8Array.from(atob(audioWavB64), (c) => c.charCodeAt(0));
    url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  } catch {
    return; // Malformed audio: stay silent rather than surfacing an error.
  }

  const audio = new Audio(url);
  currentAudio = audio;
  currentUrl = url;

  const timeline = (visemes ?? [])
    .filter(
      (f): f is VisemeFrame =>
        Array.isArray(f) &&
        typeof f[0] === "number" &&
        typeof f[1] === "string",
    )
    .sort((a, b) => a[0] - b[0]);

  const finish = () => {
    if (currentAudio !== audio) return; // superseded by a newer reply
    stopWillbotSpeech();
  };
  audio.addEventListener("ended", finish);
  audio.addEventListener("error", finish);

  let lastShape = "";
  const tick = () => {
    if (currentAudio !== audio) return;
    const t = audio.currentTime;
    let shape = "etc"; // audible but between visemes → slightly open
    for (const [at, s] of timeline) {
      if (at <= t) shape = s;
      else break;
    }
    if (shape !== lastShape) {
      lastShape = shape;
      emit(shape, true);
    }
    rafId = requestAnimationFrame(tick);
  };

  try {
    await audio.play();
    emit(timeline[0]?.[1] ?? "etc", true);
    rafId = requestAnimationFrame(tick);
  } catch {
    // Autoplay refused (no user gesture yet) — rest quietly.
    finish();
  }
}
