import { DISTRICT_SLUGS } from "@/lib/slugs";

export const dynamicParams = false;

export function generateStaticParams() {
  return DISTRICT_SLUGS.map((district) => ({ district }));
}

export default function DistrictPage() {
  return null;
}
