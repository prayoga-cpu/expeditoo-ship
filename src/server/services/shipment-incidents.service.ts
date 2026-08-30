import { nanoid } from "nanoid";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { shipmentIncidentsDal } from "@/server/dal/shipment-incidents.dal";
import { messagesService } from "@/server/services/messages.service";
import { notificationsService } from "@/server/services/notifications.service";
import { getUsersByRole } from "@/server/dal/users.dal";
import {
  toShipmentIncidentView,
  type IncidentQuery,
  type ReportIncidentInput,
  type ShipmentIncidentView,
  type UpdateIncidentInput,
} from "@/server/dto/shipment-incident.dto";
import {
  partyFor,
  shipmentErr as err,
  type Party,
  type Viewer,
} from "@/server/services/shipment-access";
import type {
  ActorRoleType,
  ShipmentIncident,
  ShipmentStatusType,
} from "@/db/schema/shipments";

/**
 * Shipment incidents — see docs/specs/incident_reporting_spec.md.
 *
 * "Something has gone wrong", from either side of a running job. Two rules
 * shape this module, and both are about what it deliberately does not do.
 *
 * 1. **An incident is a report, not a lever.** Nothing here writes to
 *    `shipments.status` or to `payments`. An incident is one party's
 *    assertion; letting an assertion gate a capture would hand either side a
 *    unilateral freeze on the other's money with no adjudication in between.
 *    The operator queue is the adjudication step.
 * 2. **A side effect may never lose the report.** The row is written first,
 *    then the timeline entry, the support thread and the operator
 *    notifications each run in their own `try`. A driver standing beside a
 *    damaged pallet does not care that the notifier is down.
 */

/** A finished run's disputes are a billing matter, not an operational one. */
const CLOSED_STATUSES: readonly ShipmentStatusType[] = [
  "DELIVERED",
  "CANCELLED",
];

/** `shipment_events` wants a role, and `staff` is not one of them. */
const actorRoleFor = (party: Party): ActorRoleType =>
  party === "staff" ? "admin" : (party as ActorRoleType);

/** Enough of the report to be readable on a timeline row. */
const summarise = (description: string) =>
  description.length > 120 ? `${description.slice(0, 117)}...` : description;

const isStaff = (viewer: Viewer) =>
  Boolean(viewer.isAdmin || viewer.isOperator);

export const shipmentIncidentsService = {
  /**
   * File one. Any party to the run may — that is the whole requirement, and it
   * falls out of `partyFor()` without a new access model.
   */
  async report(
    shipmentId: string,
    input: ReportIncidentInput,
    viewer: Viewer
  ): Promise<ShipmentIncidentView> {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);

    const party = partyFor(ownership, viewer);
    if (party === "none") throw err("FORBIDDEN", 403);

    if (CLOSED_STATUSES.includes(ownership.status)) {
      throw err("INCIDENT_RUN_CLOSED", 409);
    }

    const incident = await shipmentIncidentsDal.create({
      id: nanoid(),
      shipmentId,
      category: input.category,
      severity: input.severity,
      description: input.description,
      photoUrls: input.photoUrls,
      reportedByUserId: viewer.userId,
      reportedByRole: actorRoleFor(party),
    });

    // Everything below is additive. None of it may fail the report.
    await this.announce(incident, ownership.status, party, viewer);

    const linked = await shipmentIncidentsDal.getById(incident.id);
    return toShipmentIncidentView(linked ?? incident, null, true);
  },

  /**
   * The three side effects, each isolated. Split out of `report` to keep both
   * under the 50-line rule (docs/rules.md §0.2) and to make the ordering — row
   * first, always — legible.
   */
  async announce(
    incident: ShipmentIncident,
    status: ShipmentStatusType,
    party: Party,
    viewer: Viewer
  ) {
    // Onto the timeline both parties already read, so the incident announces
    // itself without either surface having to poll for one.
    await shipmentsDal
      .createEvent({
        id: nanoid(),
        shipmentId: incident.shipmentId,
        status,
        previousStatus: null,
        actorId: viewer.userId,
        actorRole: incident.reportedByRole,
        note: summarise(incident.description),
        metadata: JSON.stringify({
          incidentId: incident.id,
          category: incident.category,
          severity: incident.severity,
        }),
      })
      .catch((error) => console.error("incident event failed", error));

    // An operator filing on a client's behalf should not open a support thread
    // with themselves.
    if (party !== "staff") {
      await this.openThread(incident, viewer.userId).catch((error) =>
        console.error("incident thread failed", error)
      );
    }

    await this.notifyOperators(incident).catch((error) =>
      console.error("incident notification failed", error)
    );
  },

  /**
   * The reporter's single persistent support conversation — not a new one per
   * incident, because that is the existing model (support_chat_spec.md: "one
   * per user"). The opening message is authored by the reporter:
   * `messages.sender_id` is NOT NULL, and inventing a system user for this is
   * not worth a migration.
   */
  async openThread(incident: ShipmentIncident, reporterId: string) {
    const { conversationId } =
      await messagesService.getOrCreateSupportConversation(reporterId);

    // `sendMessageSchema` caps content at 2000 and a description may already
    // be 2000, so the prefix has to come out of that budget rather than be
    // added to it — otherwise the thread silently never opens.
    const prefix = `[${incident.category}] `;
    const content = `${prefix}${incident.description}`.slice(0, 2000);

    await messagesService.sendMessage(reporterId, { conversationId, content });

    await shipmentIncidentsDal.update(incident.id, { conversationId });
  },

  /**
   * Fan-out to everyone who can act on it.
   *
   * There is no existing notify-a-role helper, and this is the first caller
   * that needs one, so it stays here rather than becoming shared
   * infrastructure for a single use (docs/rules.md §0.3 YAGNI). Deduplicated
   * because an admin who is also an operator is one person with one inbox.
   */
  async notifyOperators(incident: ShipmentIncident) {
    const [operators, admins] = await Promise.all([
      getUsersByRole("operator"),
      getUsersByRole("admin"),
    ]);

    const recipients = new Set(
      [...operators, ...admins].filter(Boolean).map((row) => row.id)
    );

    await Promise.all(
      [...recipients].map((userId) =>
        notificationsService.createNotification({
          userId,
          type: "incident_reported",
          title: "Incident reported",
          message: summarise(incident.description),
          linkUrl: "/admin/incidents",
          data: {
            incidentId: incident.id,
            shipmentId: incident.shipmentId,
            severity: incident.severity,
          },
        })
      )
    );
  },

  /** Every party to the run sees the run's incidents. */
  async listForShipment(
    shipmentId: string,
    viewer: Viewer
  ): Promise<ShipmentIncidentView[]> {
    const ownership = await shipmentsDal.getOwnership(shipmentId);
    if (!ownership) throw err("SHIPMENT_NOT_FOUND", 404);
    if (partyFor(ownership, viewer) === "none") throw err("FORBIDDEN", 403);

    const rows = await shipmentIncidentsDal.listForShipment(shipmentId);

    return rows.map(({ incident, reporterName }) =>
      toShipmentIncidentView(
        incident,
        reporterName,
        // A support thread belongs to the person who opened it. Everyone else
        // on the run can see that an incident was raised without being handed
        // a door into someone else's conversation.
        incident.reportedByUserId === viewer.userId
      )
    );
  },

  /** The operator queue. */
  async listQueue(query: IncidentQuery, viewer: Viewer) {
    if (!isStaff(viewer)) throw err("FORBIDDEN", 403);

    const { items, total } = await shipmentIncidentsDal.listQueue(
      query.status,
      query.limit,
      query.offset
    );

    return {
      items: items.map(({ incident, reporterName, shipmentTitle }) => ({
        ...toShipmentIncidentView(incident, reporterName, true),
        shipmentTitle,
      })),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  },

  /**
   * Acknowledge or resolve. Staff only — the parties report, operators decide.
   *
   * `RESOLVED` is terminal. Reopening files a new incident, so the history of
   * what was decided and when stays append-only.
   */
  async updateStatus(
    incidentId: string,
    input: UpdateIncidentInput,
    viewer: Viewer
  ): Promise<ShipmentIncidentView> {
    if (!isStaff(viewer)) throw err("FORBIDDEN", 403);

    const incident = await shipmentIncidentsDal.getById(incidentId);
    if (!incident) throw err("INCIDENT_NOT_FOUND", 404);
    if (incident.status === "RESOLVED") {
      throw err("INCIDENT_ALREADY_RESOLVED", 409);
    }

    const now = new Date();
    const patch =
      input.status === "ACKNOWLEDGED"
        ? {
            status: "ACKNOWLEDGED" as const,
            acknowledgedAt: now,
            acknowledgedByUserId: viewer.userId,
          }
        : {
            status: "RESOLVED" as const,
            resolvedAt: now,
            resolvedByUserId: viewer.userId,
            resolutionNote: input.resolutionNote ?? null,
            // A report resolved without ever being acknowledged still had
            // someone look at it, and that moment is the same one.
            acknowledgedAt: incident.acknowledgedAt ?? now,
            acknowledgedByUserId:
              incident.acknowledgedByUserId ?? viewer.userId,
          };

    const updated = await shipmentIncidentsDal.update(incidentId, patch);
    return toShipmentIncidentView(updated, null, true);
  },
};
