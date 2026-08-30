import { api, toQuery } from "@/lib/fetcher";

/**
 * Client API for shipment incidents — see docs/specs/incident_reporting_spec.md.
 *
 * The slice owns its own wrapper rather than importing one from `create/`,
 * because features do not cross-import (docs/rules.md §1.3). Two features
 * talking to the same REST route is the intended shape; two features sharing a
 * module is not.
 */

export type IncidentCategory =
  | "damage"
  | "delay"
  | "access"
  | "vehicle"
  | "cargo_mismatch"
  | "safety"
  | "other";

export type IncidentSeverity = "low" | "medium" | "high";

export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface IncidentReporter {
  id: string | null;
  name: string | null;
  role: string;
}

export interface Incident {
  id: string;
  shipmentId: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  photoUrls: string[];
  reporter: IncidentReporter;
  /** Only ever present for the reporter — someone else's thread is not theirs. */
  conversationId: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

/** The queue adds where the run was picking up from, to orient the operator. */
export interface QueuedIncident extends Incident {
  shipmentTitle: string | null;
}

export interface IncidentQueuePage {
  items: QueuedIncident[];
  meta: { total: number; limit: number; offset: number };
}

export interface ReportIncidentBody {
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
  photoUrls: string[];
}

export interface IncidentQueueParams {
  status?: IncidentStatus;
  limit?: number;
  offset?: number;
}

export const incidentsApi = {
  listForShipment: (shipmentId: string) =>
    api.get<Incident[]>(`/api/shipments/${shipmentId}/incidents`),

  report: (shipmentId: string, body: ReportIncidentBody) =>
    api.post<Incident>(`/api/shipments/${shipmentId}/incidents`, body),

  queue: (params: IncidentQueueParams = {}) =>
    api.get<IncidentQueuePage>(`/api/admin/incidents${toQuery(params)}`),

  update: (
    incidentId: string,
    body: { status: "ACKNOWLEDGED" | "RESOLVED"; resolutionNote?: string }
  ) => api.patch<Incident>(`/api/admin/incidents/${incidentId}`, body),
};

/**
 * Photos go through the same public image path the job form uses. Not
 * `shipment_photos`: that is evidence and demands a live GPS fix, which is
 * exactly what a driver inside a warehouse does not have when they most need
 * to file (incident_reporting_spec.md §3.3).
 */
export async function uploadIncidentPhoto(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body });
  const json = await res.json();

  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? "Upload failed");
  }
  return json.data.url as string;
}
