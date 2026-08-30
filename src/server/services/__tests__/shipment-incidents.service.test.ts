import { describe, it, expect, vi, beforeEach } from "vitest";
import { shipmentIncidentsService } from "../shipment-incidents.service";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { shipmentIncidentsDal } from "@/server/dal/shipment-incidents.dal";
import { messagesService } from "@/server/services/messages.service";
import { notificationsService } from "@/server/services/notifications.service";
import { getUsersByRole } from "@/server/dal/users.dal";
import { reportIncidentSchema } from "@/server/dto/shipment-incident.dto";
import type { ShipmentError } from "@/server/services/shipment-access";

// Covers docs/specs/incident_reporting_spec.md §8.

vi.mock("@/server/dal/shipments.dal", () => ({
  shipmentsDal: {
    getOwnership: vi.fn(),
    createEvent: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock("@/server/dal/shipment-incidents.dal", () => ({
  shipmentIncidentsDal: {
    create: vi.fn(),
    getById: vi.fn(),
    listForShipment: vi.fn(),
    listQueue: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/server/services/messages.service", () => ({
  messagesService: {
    getOrCreateSupportConversation: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

vi.mock("@/server/services/notifications.service", () => ({
  notificationsService: { createNotification: vi.fn() },
}));

vi.mock("@/server/dal/users.dal", () => ({
  getUsersByRole: vi.fn(),
}));

const SHIPMENT = {
  id: "ship-1",
  shipperId: "client-1",
  carrierId: "carrier-1",
  driverId: "driver-1",
  status: "IN_TRANSIT" as const,
  listingId: "listing-1",
};

const input = (overrides: Record<string, unknown> = {}) =>
  reportIncidentSchema.parse({
    category: "delay",
    description: "Stuck behind a closed level crossing on the D920.",
    ...overrides,
  });

const incidentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "inc-1",
  shipmentId: "ship-1",
  category: "delay",
  severity: "medium",
  status: "OPEN",
  description: "Stuck behind a closed level crossing on the D920.",
  photoUrls: [],
  reportedByUserId: "driver-1",
  reportedByRole: "driver",
  conversationId: null,
  acknowledgedAt: null,
  acknowledgedByUserId: null,
  resolvedAt: null,
  resolvedByUserId: null,
  resolutionNote: null,
  createdAt: new Date("2026-08-29T10:00:00Z"),
  updatedAt: new Date("2026-08-29T10:00:00Z"),
});

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "NO_THROW";
  } catch (error) {
    return (error as ShipmentError).code;
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
    SHIPMENT as never
  );
  vi.mocked(shipmentIncidentsDal.create).mockResolvedValue(
    incidentRow() as never
  );
  vi.mocked(shipmentIncidentsDal.getById).mockResolvedValue(
    incidentRow() as never
  );
  vi.mocked(shipmentsDal.createEvent).mockResolvedValue({} as never);
  vi.mocked(messagesService.getOrCreateSupportConversation).mockResolvedValue({
    conversationId: "conv-1",
    created: true,
  } as never);
  vi.mocked(messagesService.sendMessage).mockResolvedValue({} as never);
  vi.mocked(shipmentIncidentsDal.update).mockResolvedValue(
    incidentRow() as never
  );
  vi.mocked(getUsersByRole).mockResolvedValue([] as never);
  vi.mocked(notificationsService.createNotification).mockResolvedValue(
    {} as never
  );
});

describe("who may report (§2)", () => {
  it.each([
    ["the client", { userId: "client-1" }, "shipper"],
    ["the carrier", { userId: "carrier-1" }, "carrier"],
    ["the driver", { userId: "driver-1" }, "driver"],
  ])("accepts a report from %s", async (_label, viewer, role) => {
    await shipmentIncidentsService.report("ship-1", input(), viewer);

    expect(shipmentIncidentsDal.create).toHaveBeenCalledWith(
      expect.objectContaining({ reportedByRole: role })
    );
  });

  it("accepts an operator filing on a client's behalf, as admin", async () => {
    await shipmentIncidentsService.report("ship-1", input(), {
      userId: "op-1",
      isOperator: true,
    });

    expect(shipmentIncidentsDal.create).toHaveBeenCalledWith(
      expect.objectContaining({ reportedByRole: "admin" })
    );
  });

  it("refuses a stranger", async () => {
    expect(
      await codeOf(
        shipmentIncidentsService.report("ship-1", input(), {
          userId: "nobody",
        })
      )
    ).toBe("FORBIDDEN");
  });

  it("404s an unknown shipment", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(undefined as never);

    expect(
      await codeOf(
        shipmentIncidentsService.report("ghost", input(), {
          userId: "client-1",
        })
      )
    ).toBe("SHIPMENT_NOT_FOUND");
  });
});

describe("the reporting window (§2.1)", () => {
  it.each(["DELIVERED", "CANCELLED"])("refuses a %s run", async (status) => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue({
      ...SHIPMENT,
      status,
    } as never);

    expect(
      await codeOf(
        shipmentIncidentsService.report("ship-1", input(), {
          userId: "client-1",
        })
      )
    ).toBe("INCIDENT_RUN_CLOSED");
  });

  it.each(["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"])(
    "allows a %s run",
    async (status) => {
      vi.mocked(shipmentsDal.getOwnership).mockResolvedValue({
        ...SHIPMENT,
        status,
      } as never);

      await shipmentIncidentsService.report("ship-1", input(), {
        userId: "client-1",
      });

      expect(shipmentIncidentsDal.create).toHaveBeenCalled();
    }
  );
});

describe("side effects (§4)", () => {
  it("puts the incident on the timeline both parties read", async () => {
    await shipmentIncidentsService.report("ship-1", input(), {
      userId: "driver-1",
    });

    const event = vi.mocked(shipmentsDal.createEvent).mock.calls[0][0];
    expect(event.shipmentId).toBe("ship-1");
    // The run's own status, unchanged — the event records, it does not move.
    expect(event.status).toBe("IN_TRANSIT");
    expect(event.previousStatus).toBeNull();
    expect(JSON.parse(event.metadata as string).incidentId).toBe("inc-1");
  });

  it("opens and links the reporter's support thread", async () => {
    await shipmentIncidentsService.report("ship-1", input(), {
      userId: "driver-1",
    });

    expect(
      messagesService.getOrCreateSupportConversation
    ).toHaveBeenCalledWith("driver-1");
    expect(shipmentIncidentsDal.update).toHaveBeenCalledWith("inc-1", {
      conversationId: "conv-1",
    });
  });

  it("opens no thread when staff file on a client's behalf", async () => {
    await shipmentIncidentsService.report("ship-1", input(), {
      userId: "op-1",
      isOperator: true,
    });

    expect(
      messagesService.getOrCreateSupportConversation
    ).not.toHaveBeenCalled();
  });

  it("keeps the opening message inside the 2000-char message cap", async () => {
    await shipmentIncidentsService.report(
      "ship-1",
      input({ description: "x".repeat(2000) }),
      { userId: "driver-1" }
    );

    const [, body] = vi.mocked(messagesService.sendMessage).mock.calls[0];
    expect(body.content.length).toBeLessThanOrEqual(2000);
  });

  it("notifies every operator and admin, deduplicated", async () => {
    vi.mocked(getUsersByRole).mockImplementation(async (role) =>
      role === "operator"
        ? ([{ id: "op-1" }, { id: "both-1" }] as never)
        : ([{ id: "admin-1" }, { id: "both-1" }] as never)
    );

    await shipmentIncidentsService.report("ship-1", input(), {
      userId: "driver-1",
    });

    const notified = vi
      .mocked(notificationsService.createNotification)
      .mock.calls.map(([call]) => call.userId);

    expect(notified.sort()).toEqual(["admin-1", "both-1", "op-1"]);
  });

  it("still returns the incident when the notifier throws", async () => {
    vi.mocked(getUsersByRole).mockRejectedValue(new Error("ably down"));

    const result = await shipmentIncidentsService.report("ship-1", input(), {
      userId: "driver-1",
    });

    expect(result.id).toBe("inc-1");
  });

  it("still returns the incident when the support thread throws", async () => {
    vi.mocked(messagesService.sendMessage).mockRejectedValue(
      new Error("chat down")
    );

    const result = await shipmentIncidentsService.report("ship-1", input(), {
      userId: "driver-1",
    });

    expect(result.id).toBe("inc-1");
  });

  it("never moves the shipment's status", async () => {
    await shipmentIncidentsService.report("ship-1", input(), {
      userId: "client-1",
    });

    expect(shipmentsDal.updateStatus).not.toHaveBeenCalled();
  });
});

describe("input validation (§3)", () => {
  it("rejects more than six photos", () => {
    expect(() =>
      input({ photoUrls: Array(7).fill("https://cdn.test/a.webp") })
    ).toThrow();
  });

  it("accepts six", () => {
    expect(
      input({ photoUrls: Array(6).fill("https://cdn.test/a.webp") }).photoUrls
    ).toHaveLength(6);
  });

  it("rejects a one-word description", () => {
    expect(() => input({ description: "broken" })).toThrow();
  });

  it("defaults severity to medium", () => {
    expect(input().severity).toBe("medium");
  });
});

describe("reading a run's incidents (§5)", () => {
  it("hides another party's support thread", async () => {
    vi.mocked(shipmentIncidentsDal.listForShipment).mockResolvedValue([
      {
        incident: {
          ...incidentRow(),
          reportedByUserId: "driver-1",
          conversationId: "conv-1",
        },
        reporterName: "Driver One",
      },
    ] as never);

    const [mine] = await shipmentIncidentsService.listForShipment("ship-1", {
      userId: "driver-1",
    });
    expect(mine.conversationId).toBe("conv-1");

    const [theirs] = await shipmentIncidentsService.listForShipment("ship-1", {
      userId: "client-1",
    });
    expect(theirs.conversationId).toBeNull();
  });

  it("refuses a stranger", async () => {
    expect(
      await codeOf(
        shipmentIncidentsService.listForShipment("ship-1", { userId: "nobody" })
      )
    ).toBe("FORBIDDEN");
  });
});

describe("the operator queue (§5.2)", () => {
  const staff = { userId: "op-1", isOperator: true };

  it("refuses a party", async () => {
    expect(
      await codeOf(
        shipmentIncidentsService.listQueue(
          { limit: 25, offset: 0 },
          { userId: "client-1" }
        )
      )
    ).toBe("FORBIDDEN");
  });

  it("refuses a party a status change", async () => {
    expect(
      await codeOf(
        shipmentIncidentsService.updateStatus(
          "inc-1",
          { status: "RESOLVED", resolutionNote: "sorted" },
          { userId: "carrier-1" }
        )
      )
    ).toBe("FORBIDDEN");
  });

  it("acknowledges an open incident", async () => {
    await shipmentIncidentsService.updateStatus(
      "inc-1",
      { status: "ACKNOWLEDGED" },
      staff
    );

    const [, patch] = vi.mocked(shipmentIncidentsDal.update).mock.calls[0];
    expect(patch.status).toBe("ACKNOWLEDGED");
    expect(patch.acknowledgedByUserId).toBe("op-1");
  });

  it("resolving stamps an acknowledgement that never happened", async () => {
    await shipmentIncidentsService.updateStatus(
      "inc-1",
      { status: "RESOLVED", resolutionNote: "Driver rerouted." },
      staff
    );

    const [, patch] = vi.mocked(shipmentIncidentsDal.update).mock.calls[0];
    expect(patch.status).toBe("RESOLVED");
    expect(patch.resolutionNote).toBe("Driver rerouted.");
    expect(patch.acknowledgedAt).toBeInstanceOf(Date);
  });

  it("refuses to move out of RESOLVED", async () => {
    vi.mocked(shipmentIncidentsDal.getById).mockResolvedValue({
      ...incidentRow(),
      status: "RESOLVED",
    } as never);

    expect(
      await codeOf(
        shipmentIncidentsService.updateStatus(
          "inc-1",
          { status: "ACKNOWLEDGED" },
          staff
        )
      )
    ).toBe("INCIDENT_ALREADY_RESOLVED");
  });

  it("404s an unknown incident", async () => {
    vi.mocked(shipmentIncidentsDal.getById).mockResolvedValue(
      undefined as never
    );

    expect(
      await codeOf(
        shipmentIncidentsService.updateStatus(
          "ghost",
          { status: "ACKNOWLEDGED" },
          staff
        )
      )
    ).toBe("INCIDENT_NOT_FOUND");
  });
});
