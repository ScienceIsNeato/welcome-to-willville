import { z } from "zod";

/**
 * Zod schema for the .willville.json manifest a repo can drop at its root.
 * All fields are optional; missing pieces fall back to per-repo heuristics
 * or to GitHub API metadata.
 */
export const StatusStateSchema = z.enum([
  "idea",
  "wip",
  "shipping",
  "maintenance",
  "dormant",
]);

export const QueueSchema = z
  .object({
    /** Whether this stop currently rides The Mayor's Express. */
    active: z.boolean().optional(),
    /** Human-friendly milestone name shown on the HUD ("Beta launch"). */
    milestone: z.string().optional(),
    /** Days until the milestone. Smaller = closer to the next stop. */
    eta_days: z.number().nonnegative().optional(),
    /** ISO date alternative to eta_days (auto-converted). */
    target_date: z.string().optional(),
    /** Tiebreaker when eta_days are equal. Smaller = sooner. */
    priority: z.number().int().optional(),
  })
  .partial();

export const ManifestSchema = z
  .object({
    schema_version: z.number().int().optional(),
    project: z
      .object({
        name: z.string().optional(),
        display_name: z.string().optional(),
        district: z.string().optional(),
        stop: z.string().optional(),
        lines: z.array(z.string()).optional(),
        visibility: z.enum(["public", "mayor"]).optional(),
        homepage: z.string().url().optional(),
        repo: z.string().optional(),
      })
      .optional(),
    status: z
      .object({
        state: StatusStateSchema.optional(),
        summary: z.string().optional(),
        blockers: z.array(z.string()).optional(),
        next: z.array(z.string()).optional(),
        updated: z.string().optional(),
      })
      .optional(),
    queue: QueueSchema.optional(),
  })
  .partial();

export type Manifest = z.infer<typeof ManifestSchema>;

export function parseManifest(input: unknown): Manifest | null {
  const result = ManifestSchema.safeParse(input);
  return result.success ? result.data : null;
}
