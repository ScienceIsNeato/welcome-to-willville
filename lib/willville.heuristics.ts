/**
 * Per-repo default mapping for repos that don't (yet) ship a .willville.json.
 *
 * When /api/town discovers a repo under ScienceIsNeato it looks up the
 * repo here for sensible defaults (district, lines, position).
 * A .willville.json in the repo overrides any of these fields.
 *
 * Repos not listed here are assumed to be "out of town" until someone drops
 * a manifest in them — they appear in the holding pen on the map's edge.
 */
import type { DistrictId, LineId, SiteGlyph } from "./willville";

export type Heuristic = {
  repo: string; // e.g. "ScienceIsNeato/chronic-chronicler"
  stopId: string;
  district: DistrictId;
  lines: LineId[];
  /** Optional manual placement inside the district SVG polygon. */
  position?: { x: number; y: number };
  blurb?: string;
  glyph?: SiteGlyph;
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
  // Mirrored Mile
  {
    repo: "ScienceIsNeato/10000_years_of_solitude",
    stopId: "the-solitude-stacks",
    district: "mirrored-mile",
    lines: ["writing"],
    position: { x: 160, y: 200 },
    blurb: "A novel-in-progress. Long form, slow loop.",
    glyph: {
      label: "book",
      prompt: "weathered open book with gold-edged pages and a long bookmark",
      state: "placeholder",
    },
  },

  // The Graveyard
  {
    repo: "ScienceIsNeato/GANGLIA",
    stopId: "the-furnace",
    district: "the-graveyard",
    lines: ["ai"],
    position: { x: 880, y: 220 },
    blurb: "The original AI framework. Where it all started.",
    glyph: {
      label: "coffin",
      prompt: "ornate black coffin with brass fittings and faint amber glow",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/suno-api",
    stopId: "the-suno-organ",
    district: "the-graveyard",
    lines: ["ai"],
    position: { x: 1080, y: 360 },
    blurb: "Music-generation API workbench.",
    glyph: {
      label: "pipe organ",
      prompt: "small glowing pipe organ with brass keys and musical glyphs",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/FogOfDog",
    stopId: "the-kennel",
    district: "the-graveyard",
    lines: ["web"],
    position: { x: 960, y: 200 },
    blurb: "Backend for FogOfDog.",
    glyph: {
      label: "kennel",
      prompt: "teal backend workshop kennel with server crates and signpost",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/epsilon",
    stopId: "the-compilers-forge",
    district: "the-graveyard",
    lines: ["workshop"],
    position: { x: 1040, y: 280 },
    blurb: "LLVM dabbling.",
    glyph: {
      label: "compiler forge",
      prompt: "blacksmith forge with compiler runes and molten type blocks",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/gene-builder",
    stopId: "the-gene-greenhouse",
    district: "the-graveyard",
    lines: ["workshop"],
    position: { x: 1120, y: 200 },
    blurb: "Bio side project.",
    glyph: {
      label: "gene greenhouse",
      prompt: "small glass greenhouse with helix-shaped vines and labels",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/go-playground",
    stopId: "the-go-workbench",
    district: "the-graveyard",
    lines: ["workshop"],
    position: { x: 1000, y: 320 },
    blurb: "Go language experiments and scratch work.",
    glyph: {
      label: "workbench",
      prompt: "plain wooden workbench with blueprints, tools, and test gears",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/dotFiles",
    stopId: "the-dotfile-cabinet",
    district: "the-graveyard",
    lines: [],
    position: { x: 920, y: 280 },
    blurb: "Personal shell, editor, and machine setup files.",
    glyph: {
      label: "file cabinet",
      prompt:
        "compact filing cabinet with dot-marked drawers and terminal tags",
      state: "placeholder",
    },
  },

  // Gates of Hell
  {
    repo: "ScienceIsNeato/ganglia-core",
    stopId: "the-reactor",
    district: "gates-of-hell",
    lines: ["ai"],
    position: { x: 1320, y: 660 },
    blurb: "Chatbot interface and orchestration.",
    glyph: {
      label: "reactor",
      prompt: "compact brass reactor core with blue-white light and pipes",
      state: "placeholder",
    },
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
    district: "gates-of-hell",
    lines: ["ai", "halloween"],
    position: { x: 1420, y: 700 },
    blurb: "Multimedia generation suite. Spooky-capable.",
    glyph: {
      label: "studio easel",
      prompt: "artist easel with film reels, brushes, and glowing canvas",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/ganglia-common",
    stopId: "the-toolworks",
    district: "gates-of-hell",
    lines: ["ai"],
    position: { x: 1380, y: 780 },
    blurb: "Shared utilities for the GANGLIA ecosystem.",
    glyph: {
      label: "tool chest",
      prompt: "small brass tool chest with gears, cables, and labeled drawers",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/HalloweenTracker",
    stopId: "the-watchful-pumpkin",
    district: "gates-of-hell",
    lines: ["halloween", "workshop"],
    position: { x: 1460, y: 820 },
    blurb: "OpenCV + Arduino head that tracks movement.",
    glyph: {
      label: "watchful pumpkin",
      prompt: "tracking pumpkin head with camera eye and copper servo neck",
      state: "placeholder",
    },
    queue: {
      active: true,
      milestone: "Yard-ready for October",
      etaDays: 132,
      priority: 4,
    },
  },

  // Slop Wharf
  {
    repo: "ScienceIsNeato/slop-mop",
    stopId: "the-mop-bucket",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 180, y: 480 },
    blurb: "Harm reduction for addicted agents.",
    glyph: {
      label: "mop bucket",
      prompt: "wooden mop bucket with brass wringer and tidy mop",
      state: "placeholder",
    },
    queue: { active: true, milestone: "v1.1 release", etaDays: 2, priority: 1 },
  },
  {
    repo: "ScienceIsNeato/slop-mop-action",
    stopId: "the-action-dock",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 280, y: 520 },
    blurb: "GitHub Actions wrapper for slop-mop.",
    glyph: {
      label: "action dock",
      prompt: "tiny loading dock with crates stamped action and a mop icon",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/bucket-o-slop",
    stopId: "the-slop-bucket",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 200, y: 600 },
    blurb: "Intentionally-broken test fixture for slop-mop.",
    glyph: {
      label: "slop bucket",
      prompt: "dented bucket of spilled papers and red test failure tags",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/cursor-rules",
    stopId: "the-rulebook",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 120, y: 580 },
    blurb: "Configuration and rules for AI-assisted development.",
    glyph: {
      label: "rulebook",
      prompt: "heavy rulebook with tabs, wax seal, and small checklist charms",
      state: "placeholder",
    },
  },

  // The Halls of Judgement
  {
    repo: "ScienceIsNeato/swe-audit",
    stopId: "the-audit-house",
    district: "halls-of-judgement",
    lines: ["quality", "ai"],
    position: { x: 1280, y: 360 },
    blurb: "SWE audits.",
    glyph: {
      label: "scales",
      prompt: "brass balance scales weighing code scrolls and trace crystals",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/imperium-swe-traces",
    stopId: "the-trace-station",
    district: "halls-of-judgement",
    lines: ["ai"],
    position: { x: 1420, y: 360 },
    blurb: "Recorded agent traces from the Imperium runs.",
    glyph: {
      label: "trace spool",
      prompt: "spool of glowing trace tape feeding through a brass recorder",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/snorkelAI-tasks",
    stopId: "the-task-forge",
    district: "halls-of-judgement",
    lines: ["ai"],
    position: { x: 1320, y: 440 },
    blurb: "Terminal-Bench tasks for Snorkel AI evaluation.",
    glyph: {
      label: "task forge",
      prompt: "small anvil with task cards, terminal prompt, and sparks",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/hard-collesium",
    stopId: "the-colosseum",
    district: "halls-of-judgement",
    lines: ["ai"],
    position: { x: 1460, y: 440 },
    blurb: "30 rounds of Gladiator evaluations.",
    glyph: {
      label: "colosseum",
      prompt: "tiny stone colosseum arena with score flags and torchlight",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/apertus_task_scaffolding",
    stopId: "the-apertus-drafting-desk",
    district: "halls-of-judgement",
    lines: ["quality"],
    position: { x: 1380, y: 470 },
    blurb: "Task scaffolding and documentation for Apertus work.",
    glyph: {
      label: "drafting desk",
      prompt: "drafting desk with blueprints, rubric cards, and brass ruler",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/pr-task-scaffolding",
    stopId: "the-pr-scaffold",
    district: "halls-of-judgement",
    lines: ["quality"],
    position: { x: 1500, y: 480 },
    blurb: "Templates and rubrics for PR task creation.",
    glyph: {
      label: "scaffold",
      prompt:
        "small wooden scaffold holding markdown sheets and rubric plaques",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/codebase-navigation",
    stopId: "the-map-room",
    district: "halls-of-judgement",
    lines: ["quality"],
    position: { x: 1400, y: 500 },
    blurb: "Navigation aids for understanding unfamiliar codebases.",
    glyph: {
      label: "map table",
      prompt: "table covered in folded code maps, pins, and brass compass",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/mystery",
    stopId: "the-mystery-manor",
    district: "halls-of-judgement",
    lines: ["halloween", "writing"],
    position: { x: 1300, y: 500 },
    blurb: "Best-guess placement — override via .willville.json.",
    glyph: {
      label: "mystery manor",
      prompt: "tiny crooked manor with locked gate and glowing attic window",
      state: "placeholder",
    },
  },

  // The Zeitgeist
  {
    repo: "ScienceIsNeato/ChronicChronicler",
    stopId: "the-chroniclers-tower",
    district: "the-zeitgeist",
    lines: ["web", "writing"],
    position: { x: 520, y: 180 },
    blurb: "Long-form chronicling app.",
    glyph: {
      label: "chronicle tower",
      prompt: "blue-roofed scribe tower with scrolls and clockwork quills",
      state: "placeholder",
    },
    queue: {
      active: true,
      milestone: "Closed beta invites",
      etaDays: 14,
      priority: 3,
    },
  },
  {
    repo: "ScienceIsNeato/fogofdog-frontend",
    stopId: "the-kennel-storefront",
    district: "the-zeitgeist",
    lines: ["web"],
    position: { x: 740, y: 240 },
    blurb: "Frontend for FogOfDog.",
    glyph: {
      label: "storefront",
      prompt: "small web storefront with striped awning and glowing display",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/lonely_little_vampire",
    stopId: "the-vampires-crypt",
    district: "the-zeitgeist",
    lines: ["halloween", "writing"],
    position: { x: 660, y: 200 },
    blurb: "Best-guess placement — override via .willville.json.",
    glyph: {
      label: "vampire crypt",
      prompt: "small gothic crypt with velvet-lined coffin and purple candles",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/loopcloser",
    stopId: "the-roundabout",
    district: "the-zeitgeist",
    lines: ["quality"],
    position: { x: 600, y: 160 },
    blurb: "Closes the developer feedback loop.",
    glyph: {
      label: "roundabout",
      prompt: "miniature circular rail switch with arrows and signal lights",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/razer-ripple",
    stopId: "the-light-mill",
    district: "the-zeitgeist",
    lines: ["workshop"],
    position: { x: 780, y: 180 },
    blurb: "Razer Chroma LED tinkering.",
    glyph: {
      label: "light mill",
      prompt: "small mill wheel of colored glass lights and wire channels",
      state: "placeholder",
    },
  },

  // Town Square
  {
    repo: "ScienceIsNeato/welcome-to-willville",
    stopId: "willville-town-hall",
    district: "town-square",
    lines: ["web"],
    position: { x: 800, y: 500 },
    blurb: "The town itself: map, transit, bell, and project registry.",
    glyph: {
      label: "town hall",
      prompt: "miniature town hall with bell tower and painted city map",
      state: "placeholder",
    },
  },

  // Dogwallow Ramble II
  {
    repo: "ScienceIsNeato/grocery-automation",
    stopId: "the-pantry-bot",
    district: "dogwallow-ramble-ii",
    lines: ["workshop"],
    position: { x: 240, y: 880 },
    blurb: "Automating the grocery loop.",
    glyph: {
      label: "pantry bot",
      prompt: "tiny pantry robot carrying grocery baskets and checklist scroll",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/RANDY-SHARON",
    stopId: "randy-sharons-cottage",
    district: "dogwallow-ramble-ii",
    lines: [],
    position: { x: 180, y: 820 },
    blurb: "Parents. Care, calls, calendar.",
    glyph: {
      label: "cottage",
      prompt: "warm cottage with porch light, calendar note, and flower boxes",
      state: "placeholder",
    },
  },
  {
    repo: "ScienceIsNeato/TheWallow",
    stopId: "the-wallow",
    district: "dogwallow-ramble-ii",
    lines: ["halloween"],
    position: { x: 320, y: 860 },
    blurb: "Best-guess placement — override via .willville.json.",
    glyph: {
      label: "wallow pool",
      prompt: "dark bubbling pool with carved stones and small lanterns",
      state: "placeholder",
    },
  },
];

export function heuristicForRepo(repo: string): Heuristic | undefined {
  return HEURISTICS.find((h) => h.repo.toLowerCase() === repo.toLowerCase());
}
