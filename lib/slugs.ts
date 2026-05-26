/** Tiny URL slug helpers used by routes + camera state. */
import { DISTRICTS, MANUAL_STOPS, type DistrictId } from "./willville";
import { HEURISTICS } from "./willville.heuristics";

export const DISTRICT_SLUGS: DistrictId[] = DISTRICTS.map((d) => d.id);

export type StopRef = {
  id: string;
  district: DistrictId;
};

export const KNOWN_STOPS: StopRef[] = [
  ...MANUAL_STOPS.map<StopRef>((m) => ({ id: m.id, district: m.district })),
  ...HEURISTICS.map<StopRef>((h) => ({ id: h.stopId, district: h.district })),
];

export function isKnownDistrict(slug: string): slug is DistrictId {
  return DISTRICT_SLUGS.includes(slug as DistrictId);
}
