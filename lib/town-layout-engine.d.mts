export type Point = {
  x: number;
  y: number;
};

export type TownLayoutInput = {
  generation?: {
    edgeSampleSteps?: number;
    edgeCurveFactor?: number;
    edgeSquiggleFactor?: number;
    sitePadding?: number;
    siteColumns?: number;
    siteRows?: number;
    canalSectionWidth?: number;
    canalSiteClearance?: number;
    canalSampleStepsPerSegment?: number;
  };
  townFootprintPath?: string;
  vertices: Record<string, Point>;
  canal: {
    pathD: string;
    segments: Array<{
      p0: Point;
      p1: Point;
      p2: Point;
      p3: Point;
    }>;
  };
  districts: Array<{
    id: string;
    displayName: string;
    label: Point;
    vertexIds: string[];
  }>;
};

export type ResolvedTownLayout<T extends TownLayoutInput> = Omit<
  T,
  "districts"
> & {
  townFootprintPath: string;
  districts: Array<
    T["districts"][number] & { polygon: Point[]; wallLoop: Point[] }
  >;
};

export function hashStr(input: string): number;
export function sampledEdgePoints(
  layout: TownLayoutInput,
  startVertexId: string,
  endVertexId: string,
): Point[];
export function resolveDistrictPolygon(
  layout: TownLayoutInput,
  vertexIds: string[],
): Point[];
export function resolveTownLayout<T extends TownLayoutInput>(
  layout: T,
): ResolvedTownLayout<T>;
export function resolveCanalSection(
  layout: TownLayoutInput,
  options?: {
    width?: number;
    siteClearance?: number;
    sampleSteps?: number;
  },
): {
  id: "willville-canal";
  displayName: "The Canal";
  width: number;
  siteClearance: number;
  centerline: Point[];
  northBank: Point[];
  southBank: Point[];
  polygon: Point[];
  path: string;
  northBankPath: string;
  southBankPath: string;
};
export function pointsToPath(points: Point[]): string;
