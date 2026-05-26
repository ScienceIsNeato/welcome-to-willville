type NoiseEnvelope = (progress: number) => number;

type NoiseBufferOptions = {
  smoothing: number;
  randomWeight: number;
  level: number;
};

export function makeNoiseBuffer(
  ctx: AudioContext,
  duration: number,
  envelope: NoiseEnvelope,
  options: NoiseBufferOptions,
) {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    previous =
      previous * options.smoothing +
      (Math.random() * 2 - 1) * options.randomWeight;
    channel[index] = previous * envelope(progress) * options.level;
  }

  return buffer;
}
