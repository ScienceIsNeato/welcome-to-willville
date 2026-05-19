import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TownStage } from "@/components/TownStage";
import { buildInitialStops } from "@/lib/town";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
