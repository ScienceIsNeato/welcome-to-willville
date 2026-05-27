import type { MouseEvent } from "react";
import type { GitHubWorkflowRun } from "@/lib/town";

export function followLink(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  window.location.assign(event.currentTarget.href);
}

export function repoShortName(repo: string | undefined): string {
  return repo?.split("/").at(-1) ?? "n/a";
}

export function countLabel(value: number | undefined): string {
  return Number.isFinite(value ?? NaN) ? String(value) : "n/a";
}

export function timeAgo(value: string | undefined): string {
  if (!value) return "n/a";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "n/a";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 90) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

export function normalizeDetailText(
  value: string | undefined,
  fallback: string,
): string {
  if (!value || value.trim().toLowerCase() === "none") return fallback;
  return value;
}

export function tooltipText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

export function workflowRunStatusLabel(
  status: GitHubWorkflowRun["status"],
): string {
  if (status === "success") return "success";
  if (status === "running") return "running";
  if (status === "failed") return "failed";
  return "neutral";
}

export function shortWorkflowName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;
}
