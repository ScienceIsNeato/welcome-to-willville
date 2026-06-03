/** Tiny URL slug helpers used by routes + camera state. */
import { DISTRICTS, MANUAL_STOPS, type DistrictId } from "./willville";
import { HEURISTICS } from "./willville.heuristics";
import { allyEntries } from "./town";

export type StopRef = {
  id: string;
  district: DistrictId;
};

// Ally Alley repos aren't in HEURISTICS (we don't own them), so derive their
// stop refs from the curated config — otherwise their /[district]/[stop] route
// isn't pre-rendered under `output: export` and clicking the isle 500s.
const ALLY_STOP_REFS: StopRef[] = allyEntries().map((entry) => ({
  id: entry.repo.split("/")[1]!.toLowerCase(),
  district: "ally-alley" as DistrictId,
}));

export const DISTRICT_SLUGS: DistrictId[] = Array.from(
  new Set<DistrictId>([
    ...DISTRICTS.map((d) => d.id),
    ...ALLY_STOP_REFS.map((s) => s.district),
  ]),
);

export const KNOWN_STOPS: StopRef[] = [
  ...MANUAL_STOPS.map<StopRef>((m) => ({ id: m.id, district: m.district })),
  ...HEURISTICS.map<StopRef>((h) => ({
    id: h.repo.split("/")[1]!.toLowerCase(),
    district: h.district,
  })),
  ...ALLY_STOP_REFS,
];

export function isKnownDistrict(slug: string): slug is DistrictId {
  return DISTRICT_SLUGS.includes(slug as DistrictId);
}
