"use client";

import { useMemo, useEffect, useState, useSyncExternalStore } from "react";

const DAY_MS = 1000 * 60 * 60 * 24;

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DISTRICTS, VIEWBOX } from "@/lib/willville";
import { type Stop } from "@/lib/town";
import { isKnownDistrict } from "@/lib/slugs";
import type { CanalBoat } from "@/lib/canal";
import { DistrictZone } from "./DistrictZone";
import { TransitLines } from "./TransitLines";
import { StopMarker } from "./StopMarker";
import { SpogCard } from "./SpogCard";
import { MainLine } from "./MainLine";
import { MayorsExpressHud } from "./MayorsExpressHud";
import { Canal } from "./Canal";

/**
 * The persistent stage that lives in the root layout. It renders the SVG
 * board, transit Lines, Stops, the Mayor's Express, the Canal, and the
 * framer-motion camera. The URL (via usePathname) drives the camera target
 * so navigating between Town Square, districts, and stops feels like a
 * continuous pan/zoom instead of a page swap.
 */

type Camera = { cx: number; cy: number; scale: number };

/** Focal point and zoom for the current URL (district label or stop position). */
function cameraForPath(path: string, stops: Stop[]): Camera {
  const parts = path.split("/").filter(Boolean);
  const districtSlug = parts[0];
  const stopSlug = parts[1];
  if (!districtSlug || !isKnownDistrict(districtSlug)) {
    return { cx: VIEWBOX.width / 2, cy: VIEWBOX.height / 2, scale: 1 };
  }
  const district = DISTRICTS.find((d) => d.id === districtSlug);
  if (!district) {
    return { cx: VIEWBOX.width / 2, cy: VIEWBOX.height / 2, scale: 1 };
  }
  if (stopSlug) {
    const stop = stops.find(
      (s) => s.id === stopSlug && s.district === districtSlug,
    );
    if (stop) {
      return { cx: stop.position.x, cy: stop.position.y, scale: 3.2 };
    }
  }
  return { cx: district.label.x, cy: district.label.y, scale: 2.2 };
}

export function TownStage({ initialStops }: { initialStops: Stop[] }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [stops] = useState<Stop[]>(initialStops);
  const isClient = useIsClient();

  // Live town data (overrides heuristics).
  const [liveStops, setLiveStops] = useState<Stop[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/town")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.stops)) {
          setLiveStops(data.stops as Stop[]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Live canal (open PRs across all repos).
  const [boats, setBoats] = useState<CanalBoat[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/canal")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data && Array.isArray(data.boats)) {
            setBoats(data.boats as CanalBoat[]);
          }
        })
        .catch(() => undefined);
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const currentStops = liveStops ?? stops;
  const camera = useMemo(
    () => cameraForPath(pathname, currentStops),
    [pathname, currentStops],
  );

  const parts = pathname.split("/").filter(Boolean);
  const focusedDistrict = isKnownDistrict(parts[0] ?? "") ? parts[0] : null;
  const focusedStopId = parts[1] ?? null;
  const focusedStop = currentStops.find(
    (s) => s.district === focusedDistrict && s.id === focusedStopId,
  );

  return (
    <div id="willville-stage">
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        onClick={() => {
          if (parts.length > 0) router.push("/");
        }}
      >
        <defs>
          <radialGradient id="ground" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#3b2a5e" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#15102a" stopOpacity="0.95" />
          </radialGradient>
        </defs>
        {/* Void backdrop sits outside the camera so the world has an edge to peek
            past when zoomed out. Everything else — including the painted town —
            lives inside the motion group so it pans/zooms together. */}
        <rect
          x={0}
          y={0}
          width={VIEWBOX.width}
          height={VIEWBOX.height}
          fill="#0b0719"
        />
        <motion.g
          animate={{
            x: VIEWBOX.width / 2 - camera.cx,
            y: VIEWBOX.height / 2 - camera.cy,
            scale: camera.scale,
          }}
          transition={{ type: "spring", stiffness: 80, damping: 18, mass: 0.9 }}
          style={{
            transformOrigin: `${camera.cx}px ${camera.cy}px`,
          }}
        >
          {/* The painted PNG is the map. Everything below this is an
              interactive overlay layered on top of the painting. */}
          <rect
            x={0}
            y={0}
            width={VIEWBOX.width}
            height={VIEWBOX.height}
            fill="url(#ground)"
          />
          <image
            href="/art/town/willville.png"
            x={0}
            y={0}
            width={VIEWBOX.width}
            height={VIEWBOX.height}
            preserveAspectRatio="none"
          />
          {DISTRICTS.map((d) => (
            <DistrictZone
              key={d.id}
              district={d}
              isFocused={focusedDistrict === d.id}
            />
          ))}
          <TransitLines />
          <MainLine stops={currentStops} />
          {currentStops.map((stop) => {
            const updated = stop.status.updated
              ? Date.parse(stop.status.updated)
              : NaN;
            const recently =
              isClient &&
              !Number.isNaN(updated) &&
              // eslint-disable-next-line react-hooks/purity -- client-only freshness halo
              Date.now() - updated < DAY_MS;
            return (
              <StopMarker
                key={`${stop.district}-${stop.id}`}
                stop={stop}
                isFocused={focusedStop?.id === stop.id}
                recentlyUpdated={recently}
              />
            );
          })}
          <Canal boats={boats} />
        </motion.g>
      </svg>
      {focusedStop && <SpogCard stop={focusedStop} />}
      {!focusedStop && <MayorsExpressHud stops={currentStops} />}
      {!focusedDistrict && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            color: "var(--willville-paper)",
            opacity: 0.8,
            fontSize: 14,
            letterSpacing: 0.6,
            pointerEvents: "none",
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}
        >
          Welcome to Willville · click a district to enter · trains run all
          night
        </div>
      )}
    </div>
  );
}
