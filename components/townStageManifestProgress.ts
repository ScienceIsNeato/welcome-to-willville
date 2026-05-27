type RegisteredManifestRepo = {
  fullName: string;
  source: "registry" | "auto";
  stopId: string;
};

export type ManifestRepoProgressEvent = {
  type: "repo";
  repo: string;
  stopId: string;
  result: "updated" | "skipped" | "error";
};

export type ManifestCompleteEvent = {
  type: "complete";
  updated: string[];
  skipped: string[];
  errors: string[];
  discovered: string[];
  registered: RegisteredManifestRepo[];
  newlyRegistered: string[];
  total: number;
};

export function markBellRepoCompletion(
  current: Record<string, number>,
  stopId: string,
  completedAt: number,
) {
  if (current[stopId] !== undefined) {
    return current;
  }

  return {
    ...current,
    [stopId]: completedAt,
  };
}

export async function readManifestProgress(
  response: Response,
  onRepoComplete: (event: ManifestRepoProgressEvent) => void,
): Promise<ManifestCompleteEvent> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-ndjson") || !response.body) {
    const data = (await response.json()) as Omit<ManifestCompleteEvent, "type">;
    return { type: "complete", ...data };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalEvent: ManifestCompleteEvent | null = null;

  const handleLine = (line: string) => {
    const event = JSON.parse(line) as
      | ManifestRepoProgressEvent
      | ManifestCompleteEvent
      | { type: "start" };
    if (event.type === "repo") {
      onRepoComplete(event);
      return;
    }
    if (event.type === "complete") {
      finalEvent = event;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        handleLine(line);
      }
      newlineIndex = buffer.indexOf("\n");
    }

    if (done) {
      break;
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    handleLine(trailing);
  }

  if (finalEvent) {
    return finalEvent;
  }

  throw new Error("Manifest stream ended without a completion payload");
}
