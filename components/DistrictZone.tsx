"use client";

import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import type { District } from "@/lib/willville";

type Props = {
  district: District;
  onEnterDistrict: (district: District) => void;
  isSelected?: boolean;
  isHovered?: boolean;
  layer?: "hit" | "label" | "all";
};

export function DistrictZone({
  district,
  onEnterDistrict,
  isSelected = false,
  isHovered = false,
  layer = "all",
}: Props) {
  const borderPhaseSeed = Array.from(district.id).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const borderStyle = {
    "--district-border-color": `var(${district.colorVar})`,
    "--district-border-delay": `-${(borderPhaseSeed % 8) * 0.7}s`,
  } as CSSProperties;

  const enterDistrict = (event: MouseEvent<SVGElement>) => {
    event.stopPropagation();
    onEnterDistrict(district);
  };
  const enterDistrictFromKeyboard = (event: KeyboardEvent<SVGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onEnterDistrict(district);
  };

  return (
    <g
      className={`district-zone-group district-${district.id.replace(/^the-/, "")}`}
      style={{ cursor: "pointer" }}
      aria-label={district.displayName}
    >
      {(layer === "hit" || layer === "all") && (
        <>
          <polygon
            points={district.polygon}
            className="district-zone-hit-area"
            fill="transparent"
            stroke="transparent"
            strokeWidth={0}
            pointerEvents="all"
            role="link"
            tabIndex={0}
            aria-label={`Open ${district.displayName}`}
            onClick={enterDistrict}
            onKeyDown={enterDistrictFromKeyboard}
          >
            <title>{district.displayName}</title>
          </polygon>
          <polygon
            points={district.polygon}
            className={`district-zone-backlight ${
              isSelected ? "district-zone-backlight--selected" : ""
            } ${isHovered ? "district-zone-backlight--hovered" : ""}`}
            style={borderStyle}
            fill="none"
            stroke="var(--district-border-color)"
            strokeWidth={12}
            pointerEvents="none"
            aria-hidden="true"
          />
          <polygon
            points={district.polygon}
            className={`district-zone-border district-zone-border-glow ${
              isHovered ? "district-zone-border-glow--hovered" : ""
            }`}
            style={borderStyle}
            fill="none"
            pointerEvents="none"
            aria-hidden="true"
          />
          <polygon
            points={district.polygon}
            className="district-zone-border district-zone-border-dash"
            style={borderStyle}
            fill="none"
            pointerEvents="none"
            aria-hidden="true"
          />
        </>
      )}
      {(layer === "label" || layer === "all") && (
        <text
          data-district-label={district.id}
          x={district.label.x}
          y={district.label.y}
          textAnchor="middle"
          fontSize={24}
          fontWeight={700}
          letterSpacing={1}
          fill="var(--willville-paper)"
          role="link"
          tabIndex={0}
          aria-label={`Open ${district.displayName}`}
          onClick={enterDistrict}
          onKeyDown={enterDistrictFromKeyboard}
          style={{
            cursor: "pointer",
            pointerEvents: "all",
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          {district.displayName}
        </text>
      )}
    </g>
  );
}
