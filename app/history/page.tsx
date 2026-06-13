/**
 * Time Central History Time Lapse Page.
 * All visual content lives in the root layout's <TownStage>.
 * This page returns null to allow TownStage to occupy the full viewport
 * and activate interactive time lapse playback of boat history.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "History – Time Central – Willville",
  description:
    "Replay the history of Willville's canal: watch every PR shipped across all projects animate as boats sailing west to east over two years.",
  openGraph: {
    title: "History – Time Central – Willville",
    description:
      "Replay the history of Willville's canal: watch every PR shipped across all projects animate as boats sailing west to east over two years.",
    type: "website",
  },
};

export default function HistoryPage() {
  return null;
}
