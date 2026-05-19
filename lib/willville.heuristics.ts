/**
 * Per-repo default mapping for repos that don't (yet) ship a .willville.json.
 *
 * When /api/town discovers a repo under ScienceIsNeato it looks up the
 * repo here for sensible defaults (district, lines, displayName, position).
 * A .willville.json in the repo overrides any of these fields.
 *
 * Repos not listed here are assumed to be "out of town" until someone drops
 * a manifest in them — they appear in the holding pen on the map's edge.
 */
import type { DistrictId, LineId } from "./willville";

export type Heuristic = {
  repo: string; // e.g. "ScienceIsNeato/chronic-chronicler"
  stopId: string;
  displayName: string;
  district: DistrictId;
  lines: LineId[];
  /** Optional manual placement inside the district SVG polygon. */
  position?: { x: number; y: number };
  blurb?: string;
  /**
   * Preview-only queue entry. A .willville.json's `queue` block always wins;
   * this just primes the Mayor's Express on first load so the HUD isn't empty.
   */
  queue?: {
    active: boolean;
    milestone?: string;
    etaDays?: number;
    priority?: number;
  };
};

export const HEURISTICS: Heuristic[] = [
  // The Press Row
  {
    repo: "ScienceIsNeato/10000_years_of_solitude",
    stopId: "the-solitude-stacks",
    displayName: "The Solitude Stacks",
    district: "the-press-row",
    lines: ["writing"],
    position: { x: 160, y: 200 },
    blurb: "A novel-in-progress. Long form, slow loop.",
  },

  // The Foundry
  {
    repo: "ScienceIsNeato/GANGLIA",
    stopId: "the-furnace",
    displayName: "The Furnace",
    district: "the-foundry",
    lines: ["ai"],
    position: { x: 880, y: 220 },
    blurb: "The original AI framework. Where it all started.",
  },
  {
    repo: "ScienceIsNeato/ganglia-core",
    stopId: "the-reactor",
    displayName: "The Reactor",
    district: "the-foundry",
    lines: ["ai"],
    position: { x: 1000, y: 220 },
    blurb: "Chatbot interface and orchestration.",
    queue: {
      active: true,
      milestone: "Story-to-video v2",
      etaDays: 6,
      priority: 2,
    },
  },
  {
    repo: "ScienceIsNeato/ganglia-studio",
    stopId: "the-atelier",
    displayName: "The Atelier",
    district: "the-foundry",
    lines: ["ai", "halloween"],
    position: { x: 1100, y: 280 },
    blurb: "Multimedia generation suite. Spooky-capable.",
  },
  {
    repo: "ScienceIsNeato/ganglia-common",
    stopId: "the-toolworks",
    displayName: "The Toolworks",
    district: "the-foundry",
    lines: ["ai"],
    position: { x: 940, y: 320 },
    blurb: "Shared utilities for the GANGLIA ecosystem.",
  },

  // Slop Wharf
  {
    repo: "ScienceIsNeato/slop-mop",
    stopId: "the-mop-bucket",
    displayName: "The Mop Bucket",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 180, y: 480 },
    blurb: "Harm reduction for addicted agents.",
    queue: { active: true, milestone: "v1.1 release", etaDays: 2, priority: 1 },
  },
  {
    repo: "ScienceIsNeato/slop-mop-action",
    stopId: "the-action-dock",
    displayName: "The Action Dock",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 280, y: 520 },
    blurb: "GitHub Actions wrapper for slop-mop.",
  },
  {
    repo: "ScienceIsNeato/bucket-o-slop",
    stopId: "the-slop-bucket",
    displayName: "The Slop Bucket",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 200, y: 600 },
    blurb: "Intentionally-broken test fixture for slop-mop.",
  },
  {
    repo: "ScienceIsNeato/cursor-rules",
    stopId: "the-rulebook",
    displayName: "The Rulebook",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 120, y: 580 },
    blurb: "Configuration and rules for AI-assisted development.",
  },
  {
    repo: "ScienceIsNeato/loopcloser",
    stopId: "the-roundabout",
    displayName: "The Roundabout",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 320, y: 660 },
    blurb: "Closes the developer feedback loop.",
  },

  // The Audit Yard
  {
    repo: "ScienceIsNeato/swe-audit",
    stopId: "the-audit-house",
    displayName: "The Audit House",
    district: "the-audit-yard",
    lines: ["quality", "ai"],
    position: { x: 1280, y: 360 },
    blurb: "SWE audits.",
  },
  {
    repo: "ScienceIsNeato/imperium-swe-traces",
    stopId: "the-trace-station",
    displayName: "The Trace Station",
    district: "the-audit-yard",
    lines: ["ai"],
    position: { x: 1420, y: 360 },
    blurb: "Recorded agent traces from the Imperium runs.",
  },
  {
    repo: "ScienceIsNeato/snorkelAI-tasks",
    stopId: "the-task-forge",
    displayName: "The Task Forge",
    district: "the-audit-yard",
    lines: ["ai"],
    position: { x: 1320, y: 440 },
    blurb: "Terminal-Bench tasks for Snorkel AI evaluation.",
  },
  {
    repo: "ScienceIsNeato/hard-collesium",
    stopId: "the-colosseum",
    displayName: "The Colosseum",
    district: "the-audit-yard",
    lines: ["ai"],
    position: { x: 1460, y: 440 },
    blurb: "30 rounds of Gladiator evaluations.",
  },

  // Web Row
  {
    repo: "ScienceIsNeato/ChronicChronicler",
    stopId: "the-chroniclers-tower",
    displayName: "The Chronicler's Tower",
    district: "web-row",
    lines: ["web", "writing"],
    position: { x: 520, y: 180 },
    blurb: "Long-form chronicling app.",
    queue: {
      active: true,
      milestone: "Closed beta invites",
      etaDays: 14,
      priority: 3,
    },
  },
  {
    repo: "ScienceIsNeato/FogOfDog",
    stopId: "the-kennel",
    displayName: "The Kennel",
    district: "web-row",
    lines: ["web"],
    position: { x: 660, y: 200 },
    blurb: "Backend for FogOfDog.",
  },
  {
    repo: "ScienceIsNeato/fogofdog-frontend",
    stopId: "the-kennel-storefront",
    displayName: "The Kennel Storefront",
    district: "web-row",
    lines: ["web"],
    position: { x: 740, y: 240 },
    blurb: "Frontend for FogOfDog.",
  },

  // The Sawmill District
  {
    repo: "ScienceIsNeato/razer-ripple",
    stopId: "the-light-mill",
    displayName: "The Light Mill",
    district: "the-sawmill-district",
    lines: ["workshop"],
    position: { x: 480, y: 720 },
    blurb: "Razer Chroma LED tinkering.",
  },
  {
    repo: "ScienceIsNeato/epsilon",
    stopId: "the-compilers-forge",
    displayName: "The Compiler's Forge",
    district: "the-sawmill-district",
    lines: ["workshop"],
    position: { x: 620, y: 720 },
    blurb: "LLVM dabbling.",
  },
  {
    repo: "ScienceIsNeato/gene-builder",
    stopId: "the-gene-greenhouse",
    displayName: "The Gene Greenhouse",
    district: "the-sawmill-district",
    lines: ["workshop"],
    position: { x: 760, y: 720 },
    blurb: "Bio side project.",
  },
  {
    repo: "ScienceIsNeato/grocery-automation",
    stopId: "the-pantry-bot",
    displayName: "The Pantry Bot",
    district: "the-sawmill-district",
    lines: ["workshop"],
    position: { x: 680, y: 860 },
    blurb: "Automating the grocery loop.",
  },

  // Hallow Hollow
  {
    repo: "ScienceIsNeato/HalloweenTracker",
    stopId: "the-watchful-pumpkin",
    displayName: "The Watchful Pumpkin",
    district: "hallow-hollow",
    lines: ["halloween", "workshop"],
    position: { x: 1320, y: 660 },
    blurb: "OpenCV + Arduino head that tracks movement.",
    queue: {
      active: true,
      milestone: "Yard-ready for October",
      etaDays: 132,
      priority: 4,
    },
  },
  {
    repo: "ScienceIsNeato/lonely_little_vampire",
    stopId: "the-vampires-crypt",
    displayName: "The Vampire's Crypt",
    district: "hallow-hollow",
    lines: ["halloween", "writing"],
    position: { x: 1420, y: 700 },
    blurb: "Best-guess placement — override via .willville.json.",
  },
  {
    repo: "ScienceIsNeato/TheWallow",
    stopId: "the-wallow",
    displayName: "The Wallow",
    district: "hallow-hollow",
    lines: ["halloween"],
    position: { x: 1340, y: 820 },
    blurb: "Best-guess placement — override via .willville.json.",
  },
  {
    repo: "ScienceIsNeato/mystery",
    stopId: "the-mystery-manor",
    displayName: "The Mystery Manor",
    district: "hallow-hollow",
    lines: ["halloween", "writing"],
    position: { x: 1460, y: 820 },
    blurb: "Best-guess placement — override via .willville.json.",
  },

  // The Hearth
  {
    repo: "ScienceIsNeato/RANDY-SHARON",
    stopId: "randy-sharons-cottage",
    displayName: "Randy & Sharon's Cottage",
    district: "the-hearth",
    lines: [],
    position: { x: 180, y: 820 },
    blurb: "Parents. Care, calls, calendar.",
  },
];

export function heuristicForRepo(repo: string): Heuristic | undefined {
  return HEURISTICS.find((h) => h.repo.toLowerCase() === repo.toLowerCase());
}
