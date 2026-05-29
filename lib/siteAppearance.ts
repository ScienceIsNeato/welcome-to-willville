import appearanceManifest from "@/data/town-site-appearance.v1.json";

export type SiteForegroundMode = "sprite" | "background-only";

export type SiteAppearanceUnderlay = {
  enabled: boolean;
  src?: string;
  cacheKey?: string;
};

type SiteAppearanceOverride = {
  stopId: string;
  foregroundMode?: SiteForegroundMode;
  underlay?: SiteAppearanceUnderlay;
};

type SiteAppearanceManifest = {
  version: string;
  defaults: {
    foregroundMode: SiteForegroundMode;
    underlay: SiteAppearanceUnderlay;
  };
  sites: SiteAppearanceOverride[];
};

type SiteAppearance = {
  stopId: string;
  foregroundMode: SiteForegroundMode;
  underlay: SiteAppearanceUnderlay;
};

const manifest = appearanceManifest as SiteAppearanceManifest;

const DEFAULT_UNDERLAY: SiteAppearanceUnderlay = {
  ...manifest.defaults.underlay,
};

const APPEARANCE_BY_STOP = new Map(
  manifest.sites.map((entry) => [entry.stopId, entry]),
);

function siteAppearanceForStop(stopId: string): SiteAppearance {
  const override = APPEARANCE_BY_STOP.get(stopId);
  return {
    stopId,
    foregroundMode:
      override?.foregroundMode ?? manifest.defaults.foregroundMode,
    underlay: {
      ...DEFAULT_UNDERLAY,
      ...override?.underlay,
    },
  };
}

export function siteForegroundModeForStop(stopId: string): SiteForegroundMode {
  return siteAppearanceForStop(stopId).foregroundMode;
}

export function siteUnderlayForStop(stopId: string): SiteAppearanceUnderlay {
  return siteAppearanceForStop(stopId).underlay;
}

export function siteAppearanceManifestVersion(): string {
  return manifest.version;
}
