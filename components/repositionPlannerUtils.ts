import type { ManualStop } from "@/lib/willville";

export type RepositionStopDelta = {
  original: { x: number; y: number; district: ManualStop["district"] };
  current: { x: number; y: number; district: ManualStop["district"] };
};
