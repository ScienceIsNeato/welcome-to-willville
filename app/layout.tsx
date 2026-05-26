import type { Metadata } from "next";
import "./globals.css";
import { TownStage } from "@/components/TownStage";
import { buildInitialStops } from "@/lib/town";

export const metadata: Metadata = {
  title: "Welcome to Willville",
  description:
    "A purely-visual town where Will's projects live. Wander the districts, watch the trains run.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const month = new Date().getMonth();
  const seasonClass = month === 9 ? "is-october" : "";
  const initialStops = buildInitialStops();
  return (
    <html lang="en" className="h-full antialiased">
      <body className={seasonClass}>
        <TownStage initialStops={initialStops} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
