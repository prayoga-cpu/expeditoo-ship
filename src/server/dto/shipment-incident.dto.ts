import { z } from "zod";
import {
  actorRoleEnum,
  shipmentIncidentCategoryEnum,
  shipmentIncidentSeverityEnum,
  shipmentIncidentStatusEnum,
} from "@/db/schema/shipments";
import type { ShipmentIncident } from "@/db/schema/shipments";

/**
 * Every enum here is derived from its `pgEnum`, never restated — the same rule
 * the role enum is under (CLAUDE.md §Gotchas 8). A hand-copied list is how a
 * value silently stops validating.
 */
export const incidentCategorySchema = z.enum(
  shipmentIncidentCategoryEnum.enumValues
);
export const incidentSeveritySchema = z.enum(
  shipmentIncidentSeverityEnum.enumValues
);
export const incidentStatusSchema = z.enum(
  shipmentIncidentStatusEnum.enumValues
);

/** Matches `MAX_PER_STAGE` in the photos service — enough angles, bounded bucket. */
export const MAX_INCIDENT_PHOTOS = 6;

/**
 * What a reporter sends.
 *
 * The floor on `description` is 10 rather than 1: a one-word incident costs an
 * operator a round trip to find out what happened, and the person who knows is
 * the one already typing.
 */
export const reportIncidentSchema = z.object({
  category: incidentCategorySchema,
  severity: incidentSeveritySchema.default("medium"),
  description: z.string().trim().min(10).max(2000),
  photoUrls: z.array(z.string().url()).max(MAX_INCIDENT_PHOTOS).default([]),
});

export type ReportIncidentInput = z.infer<typeof reportIncidentSchema>;

/**
 * Staff-only. `RESOLVED` demands a note: a queue emptied without reasons
 * teaches nobody anything the next time the same thing happens.
 */
export const updateIncidentSchema = z
  .object({
    status: z.enum(["ACKNOWLEDGED", "RESOLVED"]),
    resolutionNote: z.string().trim().min(3).max(2000).optional(),
  })
  .refine(
    (value) => value.status !== "RESOLVED" || Boolean(value.resolutionNote),
    { path: ["resolutionNote"], message: "A resolution note is required" }
  );

export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

export const incidentQuerySchema = z.object({
  status: incidentStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type IncidentQuery = z.infer<typeof incidentQuerySchema>;

/** Who filed it, resolved to something a screen can print. */
export interface IncidentReporter {
  id: string | null;
  name: string | null;
  role: (typeof actorRoleEnum.enumValues)[number];
}

export interface ShipmentIncidentView {
  id: string;
  shipmentId: string;
  category: (typeof shipmentIncidentCategoryEnum.enumValues)[number];
  severity: (typeof shipmentIncidentSeverityEnum.enumValues)[number];
  status: (typeof shipmentIncidentStatusEnum.enumValues)[number];
  description: string;
  photoUrls: string[];
  reporter: IncidentReporter;
  /**
   * Present only when the viewer is the reporter. Everyone else on a run can
   * see that an incident was raised without being handed a door into someone
   * else's support thread.
   */
  conversationId: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export function toShipmentIncidentView(
  incident: ShipmentIncident,
  reporterName: string | null,
  canSeeConversation: boolean
): ShipmentIncidentView {
  return {
    id: incident.id,
    shipmentId: incident.shipmentId,
    category: incident.category,
    severity: incident.severity,
    status: incident.status,
    description: incident.description,
    photoUrls: incident.photoUrls ?? [],
    reporter: {
      id: incident.reportedByUserId,
      name: reporterName,
      role: incident.reportedByRole,
    },
    conversationId: canSeeConversation ? incident.conversationId : null,
    acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    resolutionNote: incident.resolutionNote,
    createdAt: incident.createdAt.toISOString(),
  };
}
