import type { DistrictId } from "@/lib/willville";

type RepaintPreviewDescriptor = {
  stopId: string;
  path: string;
  cacheBust: string;
  updatedAt: string;
};

export type RepaintQueueJobRecord = {
  id: string;
  stopId: string;
  displayName: string;
  status: "queued" | "running" | "awaiting_review" | "reverting" | "failed";
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  change: {
    stopId: string;
    from: {
      x: number;
      y: number;
      district: DistrictId;
    };
    to: {
      x: number;
      y: number;
      district: DistrictId;
    };
  };
  preview?: RepaintPreviewDescriptor | null;
  logs?: Array<{
    at: string;
    stream: "stdout" | "stderr" | "system";
    text: string;
  }>;
  manifestBackup?: string | null;
  error?: string | null;
};

export type RepaintQueueApiResponse = {
  activeJob?: RepaintQueueJobRecord | null;
  acceptedPreviews?: RepaintPreviewDescriptor[];
  available?: boolean;
  acceptedJob?: {
    id: string;
    stopId: string;
    displayName: string;
  };
  rejectedJob?: {
    id: string;
    stopId: string;
    displayName: string;
  };
  canceledJob?: {
    id?: string;
    stopId?: string;
    displayName: string;
  };
  error?: string;
};
