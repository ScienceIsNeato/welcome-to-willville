import type {
  WillvilleAgentAction,
  WillvilleManifest,
  WillvillePacket,
} from "../../lib/town";

const PACKET_RE = /<!--\s*willville\b([\s\S]*?)-->/;

export class WillvillePacketParser {
  parse(body: string): WillvillePacket | undefined {
    const match = PACKET_RE.exec(body);
    if (!match) return undefined;
    const inner = match[1]!;
    const pkt: WillvillePacket = {};

    for (const line of inner.split("\n")) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim();
      const val = line.slice(colon + 1).trim();
      if (!val) continue;

      switch (key) {
        case "doing":
          pkt.doing = val;
          break;
        case "done":
          pkt.done = val;
          break;
        case "next":
          pkt.next = val;
          break;
        case "blocked":
          pkt.blocked = val;
          break;
        case "risk":
          pkt.risk = val;
          break;
        case "eta":
          pkt.eta = val;
          break;
        case "milestone":
          pkt.milestone = val;
          break;
        case "status":
          if (
            ["wip", "shipping", "maintenance", "dormant", "unknown"].includes(
              val,
            )
          ) {
            pkt.status = val as WillvillePacket["status"];
          }
          break;
        case "summary":
          pkt.summary = val;
          break;
        case "eta_date":
          pkt.etaDate = val;
          pkt.eta ??= val;
          break;
      }
    }

    const blockersRe = /\bblockers:[\s\S]*?(?=\n\w|$)/;
    const blockersMatch = blockersRe.exec(inner);
    if (blockersMatch) {
      const items = [...blockersMatch[0].matchAll(/^\s*-\s*(.+)/gm)]
        .map((m) => m[1]!.trim())
        .filter(Boolean);
      if (items.length) {
        pkt.blockers = items;
        pkt.blocked ??= items[0];
      }
    }

    return Object.keys(pkt).length > 0 ? pkt : undefined;
  }
}

export class WillvilleManifestParser {
  parse(raw: unknown): WillvilleManifest | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const source = raw as {
      schema_version?: unknown;
      project?: {
        name?: unknown;
        display_name?: unknown;
        district?: unknown;
        stop?: unknown;
        lines?: unknown;
        visibility?: unknown;
        homepage?: unknown;
        repo?: unknown;
      };
      status?: {
        state?: unknown;
        summary?: unknown;
        blockers?: unknown;
        next?: unknown;
        updated?: unknown;
      };
      queue?: {
        active?: unknown;
        milestone?: unknown;
        eta_days?: unknown;
        target_date?: unknown;
        priority?: unknown;
      };
      agent?: {
        status?: unknown;
        direction?: unknown;
        difficulties?: unknown;
        needs_human?: unknown;
        last_update?: unknown;
        actions?: unknown;
      };
    };

    const project =
      source.project && typeof source.project === "object"
        ? {
            name:
              typeof source.project.name === "string"
                ? source.project.name
                : undefined,
            displayName:
              typeof source.project.display_name === "string"
                ? source.project.display_name
                : undefined,
            district:
              typeof source.project.district === "string"
                ? source.project.district
                : undefined,
            stop:
              typeof source.project.stop === "string"
                ? source.project.stop
                : undefined,
            lines: this.parseStringArray(source.project.lines),
            visibility:
              source.project.visibility === "public" ||
              source.project.visibility === "mayor"
                ? (source.project.visibility as "public" | "mayor")
                : undefined,
            homepage:
              typeof source.project.homepage === "string"
                ? source.project.homepage
                : undefined,
            repo:
              typeof source.project.repo === "string"
                ? source.project.repo
                : undefined,
          }
        : undefined;

    const status =
      source.status && typeof source.status === "object"
        ? {
            state: this.parseStatusState(source.status.state),
            summary:
              typeof source.status.summary === "string"
                ? source.status.summary
                : undefined,
            blockers: this.parseStringArray(source.status.blockers),
            next: this.parseStringArray(source.status.next),
            updated:
              typeof source.status.updated === "string"
                ? source.status.updated
                : undefined,
          }
        : undefined;

    const queue =
      source.queue && typeof source.queue === "object"
        ? {
            active:
              typeof source.queue.active === "boolean"
                ? source.queue.active
                : undefined,
            milestone:
              typeof source.queue.milestone === "string"
                ? source.queue.milestone
                : undefined,
            etaDays:
              typeof source.queue.eta_days === "number"
                ? source.queue.eta_days
                : undefined,
            targetDate:
              typeof source.queue.target_date === "string"
                ? source.queue.target_date
                : undefined,
            priority:
              typeof source.queue.priority === "number"
                ? source.queue.priority
                : undefined,
          }
        : undefined;

    const actions = this.parseActions(source.agent?.actions);
    const agent =
      source.agent && typeof source.agent === "object"
        ? {
            status:
              typeof source.agent.status === "string"
                ? source.agent.status
                : undefined,
            direction:
              typeof source.agent.direction === "string"
                ? source.agent.direction
                : undefined,
            difficulties:
              typeof source.agent.difficulties === "string"
                ? source.agent.difficulties
                : undefined,
            needsHuman:
              typeof source.agent.needs_human === "string"
                ? source.agent.needs_human
                : undefined,
            lastUpdate:
              typeof source.agent.last_update === "string"
                ? source.agent.last_update
                : undefined,
            actions,
          }
        : undefined;

    if (!project && !status && !queue && !agent) return undefined;

    return {
      schemaVersion:
        typeof source.schema_version === "number"
          ? source.schema_version
          : undefined,
      project,
      status,
      queue,
      agent,
    };
  }

  private parseStringArray(rawValue: unknown): string[] | undefined {
    if (!Array.isArray(rawValue)) return undefined;
    const values = rawValue.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );
    return values.length > 0 ? values : undefined;
  }

  private parseStatusState(
    rawValue: unknown,
  ): NonNullable<WillvilleManifest["status"]>["state"] {
    if (typeof rawValue !== "string") return undefined;
    if (
      ["idea", "wip", "shipping", "maintenance", "dormant", "unknown"].includes(
        rawValue,
      )
    ) {
      return rawValue as NonNullable<WillvilleManifest["status"]>["state"];
    }
    return undefined;
  }

  private parseActions(
    rawActions: unknown,
  ): WillvilleAgentAction[] | undefined {
    if (!Array.isArray(rawActions)) return undefined;
    return rawActions.flatMap((action) => {
      if (!action || typeof action !== "object") return [];
      const item = action as { name?: unknown; status?: unknown };
      if (typeof item.name !== "string") return [];
      return [
        {
          name: item.name,
          status: typeof item.status === "string" ? item.status : "planned",
        },
      ];
    });
  }
}
