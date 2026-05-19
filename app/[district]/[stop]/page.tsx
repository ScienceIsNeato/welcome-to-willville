import { KNOWN_STOPS } from "@/lib/slugs";

export const dynamicParams = false;

export function generateStaticParams() {
  return KNOWN_STOPS.map((s) => ({ district: s.district, stop: s.id }));
}

export default function StopPage() {
  return null;
}
