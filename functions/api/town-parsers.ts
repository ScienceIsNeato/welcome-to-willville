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
      agent?: {
        status?: unknown;
        direction?: unknown;
        difficulties?: unknown;
        needs_human?: unknown;
        last_update?: unknown;
        actions?: unknown;
      };
    };
    if (!source.agent || typeof source.agent !== "object") return undefined;

    const actions = this.parseActions(source.agent.actions);
    return {
      schemaVersion:
        typeof source.schema_version === "number"
          ? source.schema_version
          : undefined,
      agent: {
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
      },
    };
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
