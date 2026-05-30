/**
 * Per-repo default mapping for repos that don't (yet) ship a .willville.json.
 *
 * When /api/town discovers a repo under ScienceIsNeato it looks up the
 * repo here for sensible defaults (district, lines, position).
 * A .willville.json in the repo overrides any of these fields.
 *
 * Repos not listed here still get provisional town placement from repo topics
 * and deterministic auto-positioning. This table is for curated district
 * overrides, blurbs, glyph hints, and queue defaults when we want a repo to
 * feel intentional before it ships its own `.willville.json`.
 */
import type { DistrictId, LineId, SiteGlyph } from "./willville";

export type Heuristic = {
  repo: string; // e.g. "ScienceIsNeato/chronic-chronicler"
  displayName?: string;
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
  {
    repo: "ScienceIsNeato/10000_years_of_solitude",
    displayName: "10000_years_of_solitude",
    district: "mirrored-mile",
    lines: ["writing"],
    position: { x: 376, y: 355 },
    blurb: "A novel-in-progress. Long form, slow loop.",
    glyph: {
      label: "book",
      prompt: "weathered open book with gold-edged pages and a long bookmark",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/GANGLIA",
    displayName: "GANGLIA",
    district: "the-graveyard",
    lines: ["ai"],
    position: { x: 1133, y: 272 },
    blurb: "The original AI framework. Where it all started.",
    glyph: {
      label: "coffin",
      prompt: "ornate black coffin with brass fittings and faint amber glow",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/suno-api",
    displayName: "suno-api",
    district: "the-graveyard",
    lines: ["ai"],
    position: { x: 1133, y: 447 },
    blurb: "Music-generation API workbench.",
    glyph: {
      label: "pipe organ",
      prompt: "small glowing pipe organ with brass keys and musical glyphs",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/FogOfDog",
    displayName: "FogOfDog",
    district: "the-graveyard",
    lines: ["web"],
    position: { x: 1233, y: 361 },
    blurb: "Backend for FogOfDog.",
    glyph: {
      label: "kennel",
      prompt: "teal backend workshop kennel with server crates and signpost",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/epsilon",
    displayName: "epsilon",
    district: "the-graveyard",
    lines: ["workshop"],
    position: { x: 1033, y: 321 },
    blurb: "LLVM dabbling.",
    glyph: {
      label: "compiler forge",
      prompt: "blacksmith forge with compiler runes and molten type blocks",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/gene-builder",
    displayName: "gene-builder",
    district: "the-graveyard",
    lines: ["workshop"],
    position: { x: 1259, y: 462 },
    blurb: "Bio side project.",
    glyph: {
      label: "gene greenhouse",
      prompt: "small glass greenhouse with helix-shaped vines and labels",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/go-playground",
    displayName: "go-playground",
    district: "the-graveyard",
    lines: ["workshop"],
    position: { x: 1291, y: 581 },
    blurb: "Go language experiments and scratch work.",
    glyph: {
      label: "workbench",
      prompt: "plain wooden workbench with blueprints, tools, and test gears",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/dotFiles",
    displayName: "dotFiles",
    district: "the-graveyard",
    lines: [],
    position: { x: 1336, y: 400 },
    blurb: "Personal shell, editor, and machine setup files.",
    glyph: {
      label: "file cabinet",
      prompt:
        "compact filing cabinet with dot-marked drawers and terminal tags",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/ganglia-core",
    displayName: "ganglia-core",
    district: "gates-of-hell",
    lines: ["ai"],
    position: { x: 972, y: 947 },
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
    displayName: "ganglia-studio",
    district: "gates-of-hell",
    lines: ["ai", "halloween"],
    position: { x: 1140, y: 918 },
    blurb: "Multimedia generation suite. Spooky-capable.",
    glyph: {
      label: "studio easel",
      prompt: "artist easel with film reels, brushes, and glowing canvas",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/ganglia-common",
    displayName: "ganglia-common",
    district: "gates-of-hell",
    lines: ["ai"],
    position: { x: 886, y: 1027 },
    blurb: "Shared utilities for the GANGLIA ecosystem.",
    glyph: {
      label: "tool chest",
      prompt: "small brass tool chest with gears, cables, and labeled drawers",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/HalloweenTracker",
    displayName: "HalloweenTracker",
    district: "gates-of-hell",
    lines: ["halloween", "workshop"],
    position: { x: 1059, y: 865 },
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

  {
    repo: "ScienceIsNeato/slop-mop",
    displayName: "slop-mop",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 401, y: 696 },
    blurb: "Harm reduction for addicted agents.",
    glyph: {
      label: "mop bucket",
      prompt: "wooden mop bucket with brass wringer and tidy mop",
      state: "placeholder",
    },
    queue: {
      active: true,
      milestone: "v1.1 release",
      etaDays: 2,
      priority: 1,
    },
  },

  {
    repo: "ScienceIsNeato/slop-mop-action",
    displayName: "slop-mop-action",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 455, y: 602 },
    blurb: "GitHub Actions wrapper for slop-mop.",
    glyph: {
      label: "action dock",
      prompt: "tiny loading dock with crates stamped action and a mop icon",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/slop-mop-website",
    displayName: "slop-mop-website",
    district: "slop-wharf",
    lines: ["quality", "web"],
    blurb: "The public front door for slop-mop.",
    glyph: {
      label: "harbor sign",
      prompt:
        "painted harbor signboard for slop-mop with tidy dock hardware and a small mop emblem",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/bucket-o-slop",
    displayName: "bucket-o-slop",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 510, y: 780 },
    blurb: "Intentionally-broken test fixture for slop-mop.",
    glyph: {
      label: "slop bucket",
      prompt: "dented bucket of spilled papers and red test failure tags",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/cursor-rules",
    displayName: "cursor-rules",
    district: "slop-wharf",
    lines: ["quality"],
    position: { x: 302, y: 754 },
    blurb: "Configuration and rules for AI-assisted development.",
    glyph: {
      label: "rulebook",
      prompt: "heavy rulebook with tabs, wax seal, and small checklist charms",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/swe-audit",
    displayName: "swe-audit",
    district: "halls-of-judgement",
    lines: ["quality", "ai"],
    position: { x: 1077, y: 680 },
    blurb: "SWE audits.",
    glyph: {
      label: "scales",
      prompt: "brass balance scales weighing code scrolls and trace crystals",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/imperium-swe-traces",
    displayName: "imperium-swe-traces",
    district: "halls-of-judgement",
    lines: ["ai"],
    position: { x: 1058, y: 541 },
    blurb: "Recorded agent traces from the Imperium runs.",
    glyph: {
      label: "trace spool",
      prompt: "spool of glowing trace tape feeding through a brass recorder",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/snorkelAI-tasks",
    displayName: "snorkelAI-tasks",
    district: "halls-of-judgement",
    lines: ["ai"],
    position: { x: 980, y: 518 },
    blurb: "Terminal-Bench tasks for Snorkel AI evaluation.",
    glyph: {
      label: "task forge",
      prompt: "small anvil with task cards, terminal prompt, and sparks",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/hard-collesium",
    displayName: "hard-collesium",
    district: "halls-of-judgement",
    lines: ["ai"],
    position: { x: 1194, y: 633 },
    blurb: "30 rounds of Gladiator evaluations.",
    glyph: {
      label: "colosseum",
      prompt: "tiny stone colosseum arena with score flags and torchlight",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/apertus_task_scaffolding",
    displayName: "apertus_task_scaffolding",
    district: "halls-of-judgement",
    lines: ["quality"],
    position: { x: 941, y: 628 },
    blurb: "Task scaffolding and documentation for Apertus work.",
    glyph: {
      label: "drafting desk",
      prompt: "drafting desk with blueprints, rubric cards, and brass ruler",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/pr-task-scaffolding",
    displayName: "pr-task-scaffolding",
    district: "halls-of-judgement",
    lines: ["quality"],
    position: { x: 1152, y: 716 },
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
    displayName: "codebase-navigation",
    district: "halls-of-judgement",
    lines: ["quality"],
    position: { x: 1118, y: 572 },
    blurb: "Navigation aids for understanding unfamiliar codebases.",
    glyph: {
      label: "map table",
      prompt: "table covered in folded code maps, pins, and brass compass",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/mystery",
    displayName: "mystery",
    district: "halls-of-judgement",
    lines: ["halloween", "writing"],
    position: { x: 1014, y: 666 },
    blurb: "Best-guess placement — override via .willville.json.",
    glyph: {
      label: "mystery manor",
      prompt: "tiny crooked manor with locked gate and glowing attic window",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/ChronicChronicler",
    displayName: "ChronicChronicler",
    district: "the-zeitgeist",
    lines: ["web", "writing"],
    position: { x: 731, y: 149 },
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
    displayName: "fogofdog-frontend",
    district: "the-zeitgeist",
    lines: ["web"],
    position: { x: 932, y: 266 },
    blurb: "Explore your neighborhood from the perspective of a dog",
    glyph: {
      label: "storefront",
      prompt: "small web storefront with striped awning and glowing display",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/lonely_little_vampire",
    displayName: "lonely_little_vampire",
    district: "mirrored-mile",
    lines: ["halloween", "writing"],
    position: { x: 580, y: 230 },
    blurb: "Childrens' Story about a little boy named Vlad",
    glyph: {
      label: "vampire crypt",
      prompt: "small gothic crypt with velvet-lined coffin and purple candles",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/loopcloser",
    displayName: "loopcloser",
    district: "the-zeitgeist",
    lines: ["quality"],
    position: { x: 792, y: 363 },
    blurb: "Closes the developer feedback loop.",
    glyph: {
      label: "roundabout",
      prompt: "miniature circular rail switch with arrows and signal lights",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/razer-ripple",
    displayName: "razer-ripple",
    district: "the-zeitgeist",
    lines: ["workshop"],
    position: { x: 942, y: 391 },
    blurb: "Razer Chroma LED tinkering.",
    glyph: {
      label: "light mill",
      prompt: "small mill wheel of colored glass lights and wire channels",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/welcome-to-willville",
    displayName: "welcome-to-willville",
    district: "town-square",
    lines: ["web"],
    position: { x: 533, y: 462 },
    blurb: "The town itself: map, transit, bell, and project registry.",
    glyph: {
      label: "town hall",
      prompt: "miniature town hall with bell tower and painted city map",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/grocery-automation",
    displayName: "grocery-automation",
    district: "dogwallow-ramble-ii",
    lines: ["workshop"],
    position: { x: 643, y: 996 },
    blurb: "Automating the grocery loop.",
    glyph: {
      label: "pantry bot",
      prompt: "tiny pantry robot carrying grocery baskets and checklist scroll",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/RANDY-SHARON",
    displayName: "RANDY-SHARON",
    district: "dogwallow-ramble-ii",
    lines: [],
    position: { x: 703, y: 821 },
    blurb: "Parents. Care, calls, calendar.",
    glyph: {
      label: "cottage",
      prompt: "warm cottage with porch light, calendar note, and flower boxes",
      state: "placeholder",
    },
  },

  {
    repo: "ScienceIsNeato/TheWallow",
    displayName: "TheWallow",
    district: "dogwallow-ramble-ii",
    lines: ["halloween"],
    position: { x: 724, y: 1054 },
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
