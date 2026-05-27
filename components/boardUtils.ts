import type { Stop } from "@/lib/town";

export function stopLabel(stop: Stop): string {
  return stop.repo?.split("/").pop() ?? stop.id;
}

export function isNumberedRow(input: string): boolean {
  return /^\s*(?:\d+\s|#\d|UPD\s)/.test(input);
}

export function normalizeBoardText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9 .,'#/:!?…-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
