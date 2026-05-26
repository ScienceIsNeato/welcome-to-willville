"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type SVGProps,
} from "react";

type Props = {
  panelLabel: string;
  visible: boolean;
  opacity: number;
  onToggleVisibility: () => void;
  onOpacityChange: (opacity: number) => void;
  popoverDirection?: "up" | "down";
};

export function PanelChromeControls({
  panelLabel,
  visible,
  opacity,
  onToggleVisibility,
  onOpacityChange,
  popoverDirection = "down",
}: Props) {
  const [showOpacityPicker, setShowOpacityPicker] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOpacityPicker) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setShowOpacityPicker(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowOpacityPicker(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showOpacityPicker]);

  return (
    <div ref={rootRef} style={controlClusterStyle}>
      <button
        type="button"
        onClick={onToggleVisibility}
        aria-pressed={visible}
        aria-label={visible ? `Hide ${panelLabel}` : `Show ${panelLabel}`}
        title={visible ? `Hide ${panelLabel}` : `Show ${panelLabel}`}
        style={iconButtonStyle(visible)}
      >
        {visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
      </button>

      <div style={popoverAnchorStyle}>
        <button
          type="button"
          onClick={() => setShowOpacityPicker((current) => !current)}
          aria-label={`Adjust ${panelLabel} opacity`}
          aria-expanded={showOpacityPicker}
          title={`Adjust ${panelLabel} opacity (${Math.round(opacity * 100)}%)`}
          style={iconButtonStyle(showOpacityPicker)}
        >
          <OpacityIcon />
        </button>

        {showOpacityPicker && (
          <div style={opacityPopoverStyle(popoverDirection)}>
            <span style={popoverLabelStyle}>Opacity</span>
            <input
              type="range"
              min="20"
              max="100"
              step="1"
              value={Math.round(opacity * 100)}
              onChange={(event) => {
                onOpacityChange(Number(event.target.value) / 100);
              }}
              aria-label={`${panelLabel} opacity`}
              style={sliderStyle}
            />
            <span style={popoverValueStyle}>{Math.round(opacity * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function EyeOpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      {...iconSvgProps}
      {...props}
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      {...iconSvgProps}
      {...props}
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6 0 9.5 7 9.5 7a16.3 16.3 0 0 1-3.1 3.9" />
      <path d="M6.2 6.3A16.1 16.1 0 0 0 2.5 12s3.5 7 9.5 7c1.4 0 2.6-.3 3.8-.8" />
      <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1" />
    </svg>
  );
}

function OpacityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      {...iconSvgProps}
      {...props}
    >
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h14" />
      <circle cx="9" cy="7" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="11" cy="17" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function iconButtonStyle(active: boolean): CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid rgba(230,198,106,0.38)",
    background: active
      ? "linear-gradient(180deg, rgba(36,24,12,0.94) 0%, rgba(20,12,6,0.98) 100%)"
      : "rgba(14, 12, 11, 0.86)",
    color: "var(--willville-paper)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow:
      "0 4px 12px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(230,198,106,0.14)",
    opacity: active ? 1 : 0.82,
    transition: "opacity 0.18s ease, transform 0.18s ease",
  };
}

function opacityPopoverStyle(direction: "up" | "down"): CSSProperties {
  return {
    position: "absolute",
    right: 0,
    ...(direction === "up"
      ? { bottom: "calc(100% + 8px)" }
      : { top: "calc(100% + 8px)" }),
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 112px) auto",
    alignItems: "center",
    gap: 8,
    minWidth: 214,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(230,198,106,0.28)",
    background: "rgba(14, 12, 11, 0.94)",
    color: "var(--willville-paper)",
    boxShadow:
      "0 10px 22px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(230,198,106,0.08)",
    backdropFilter: "blur(8px)",
    zIndex: 30,
  };
}

const controlClusterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: 4,
  borderRadius: 999,
  border: "1px solid rgba(230,198,106,0.18)",
  background: "rgba(8, 8, 10, 0.74)",
  boxShadow:
    "0 8px 18px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(230,198,106,0.06)",
  backdropFilter: "blur(8px)",
};

const popoverAnchorStyle: CSSProperties = {
  position: "relative",
};

const popoverLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const popoverValueStyle: CSSProperties = {
  minWidth: 34,
  fontSize: 11,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const sliderStyle: CSSProperties = {
  width: "100%",
  accentColor: "#e6c66a",
};

const iconSvgProps: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
