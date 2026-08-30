import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shipmentConfirmationsService,
  ConfirmationError,
} from "../shipment-confirmations.service";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { expedionDal } from "@/server/dal/expedion.dal";
import { emailService } from "@/server/services/email.service";
import { mintConfirmationToken } from "@/lib/confirmation-token";

// Covers docs/specs/transport_status_confirmation_spec.md §12.

vi.mock("@/server/dal/shipments.dal", () => ({
  shipmentsDal: {
    getOwnership: vi.fn(),
    getById: vi.fn(),
    createConfirmation: vi.fn(),
    getConfirmation: vi.fn(),
    getConfirmations: vi.fn(),
    // Present so a stray call to a status-moving method is a spy we can
    // assert was never touched, rather than a missing-mock crash.
    updateStatus: vi.fn(),
    createEvent: vi.fn(),
  },
}));

vi.mock("@/server/dal/expedion.dal", () => ({
  expedionDal: { getByListingId: vi.fn(), addEvent: vi.fn() },
}));

vi.mock("@/server/services/email.service", () => ({
  emailService: { sendConfirmationRequestEmail: vi.fn() },
}));

const ownership = (status: string) => ({
  id: "ship-1",
  shipperId: "shipper-1",
  carrierId: "carrier-1",
  driverId: "driver-1",
  status,
  listingId: "listing-1",
});

const CREATED = {
  id: "conf-1",
  shipmentId: "ship-1",
  milestone: "DELIVERED",
  channel: "link",
  confirmedByRole: "client",
  // The audit columns the DAL really returns. Nothing that crosses the wire
  // may carry them - one of the two write routes is unauthenticated.
  confirmedByUserId: "usr_client",
  confirmedByRef: "owner-1",
  note: "livré cassé, voir photos",
  createdAt: new Date("2026-08-29T12:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BETTER_AUTH_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  vi.mocked(expedionDal.getByListingId).mockResolvedValue(undefined as never);
  vi.mocked(shipmentsDal.createConfirmation).mockResolvedValue(
    CREATED as never
  );
});

describe("attest — when a milestone may be confirmed", () => {
  it("refuses PICKED_UP before the transporter has collected", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("ASSIGNED") as never
    );

    await expect(
      shipmentConfirmationsService.attest({
        shipmentId: "ship-1",
        milestone: "PICKED_UP",
        channel: "link",
      })
    ).rejects.toMatchObject({ code: "MILESTONE_NOT_REACHED", status: 409 });
  });

  it("refuses DELIVERED while the goods are still in transit", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("IN_TRANSIT") as never
    );

    await expect(
      shipmentConfirmationsService.attest({
        shipmentId: "ship-1",
        milestone: "DELIVERED",
        channel: "link",
      })
    ).rejects.toBeInstanceOf(ConfirmationError);
  });

  it("still allows PICKED_UP once the run has moved on", async () => {
    for (const status of ["PICKED_UP", "IN_TRANSIT", "DELIVERED"]) {
      vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
        ownership(status) as never
      );

      await expect(
        shipmentConfirmationsService.attest({
          shipmentId: "ship-1",
          milestone: "PICKED_UP",
          channel: "link",
        })
      ).resolves.toMatchObject({ alreadyConfirmed: false });
    }
  });

  it("refuses any milestone on a cancelled transport", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("CANCELLED") as never
    );

    await expect(
      shipmentConfirmationsService.attest({
        shipmentId: "ship-1",
        milestone: "PICKED_UP",
        channel: "link",
      })
    ).rejects.toMatchObject({ code: "SHIPMENT_CANCELLED", status: 409 });
  });

  it("404s for a shipment that does not exist", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(undefined as never);

    await expect(
      shipmentConfirmationsService.attest({
        shipmentId: "nope",
        milestone: "DELIVERED",
        channel: "link",
      })
    ).rejects.toMatchObject({ code: "SHIPMENT_NOT_FOUND", status: 404 });
  });
});

describe("attest — what crosses the wire", () => {
  it("never returns the audit columns, on either the fresh or the repeat path", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("DELIVERED") as never
    );

    const fresh = await shipmentConfirmationsService.attest({
      shipmentId: "ship-1",
      milestone: "DELIVERED",
      channel: "link",
    });

    // POST /api/shipments/confirm takes no credentials: a raw row would hand a
    // bearer-token holder the quote owner's id and another client's note.
    for (const key of ["confirmedByUserId", "confirmedByRef", "note"]) {
      expect(Object.keys(fresh.confirmation)).not.toContain(key);
    }
    expect(fresh.confirmation).toMatchObject({
      id: "conf-1",
      milestone: "DELIVERED",
      channel: "link",
    });

    vi.mocked(shipmentsDal.createConfirmation).mockResolvedValue(null as never);
    vi.mocked(shipmentsDal.getConfirmation).mockResolvedValue(CREATED as never);

    const repeat = await shipmentConfirmationsService.attest({
      shipmentId: "ship-1",
      milestone: "DELIVERED",
      channel: "link",
    });

    expect(JSON.stringify(repeat)).not.toContain("livré cassé");
    expect(JSON.stringify(repeat)).not.toContain("owner-1");
  });
});

describe("attest — idempotency", () => {
  it("returns the first row and inserts nothing on a second confirmation", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("DELIVERED") as never
    );
    // The unique index absorbed the insert.
    vi.mocked(shipmentsDal.createConfirmation).mockResolvedValue(null as never);
    vi.mocked(shipmentsDal.getConfirmation).mockResolvedValue(CREATED as never);

    const result = await shipmentConfirmationsService.attest({
      shipmentId: "ship-1",
      milestone: "DELIVERED",
      channel: "expedion_app",
    });

    expect(result).toMatchObject({
      alreadyConfirmed: true,
      confirmation: { id: "conf-1" },
    });
  });
});

describe("attest — the guarantee that it moves nothing", () => {
  it("leaves the status alone and writes no shipment event", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("DELIVERED") as never
    );

    await shipmentConfirmationsService.attest({
      shipmentId: "ship-1",
      milestone: "DELIVERED",
      channel: "link",
    });

    // §1: a client attestation is a stamp, not a transition. If either of
    // these ever fires, the public one-tap link has become a capability to
    // move a transport and must not be mailed.
    expect(shipmentsDal.updateStatus).not.toHaveBeenCalled();
    expect(shipmentsDal.createEvent).not.toHaveBeenCalled();
  });

  it("mirrors nothing and does not throw for a listing with no quote", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("DELIVERED") as never
    );

    await expect(
      shipmentConfirmationsService.attest({
        shipmentId: "ship-1",
        milestone: "DELIVERED",
        channel: "link",
      })
    ).resolves.toBeTruthy();

    expect(expedionDal.addEvent).not.toHaveBeenCalled();
  });

  it("names an operator rather than the client when staff answered", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("DELIVERED") as never
    );
    vi.mocked(expedionDal.getByListingId).mockResolvedValue({
      id: "quote-1",
      status: "picked_up",
      firebaseUid: "owner-1",
    } as never);

    await shipmentConfirmationsService.attest({
      shipmentId: "ship-1",
      milestone: "DELIVERED",
      channel: "expedion_app",
      confirmedByRole: "operator",
    });
    await new Promise((resolve) => setImmediate(resolve));

    const event = vi.mocked(expedionDal.addEvent).mock.calls.at(-1)![0];
    // Reporting an operator's answer as the client's would defeat the point of
    // asking the client at all.
    expect(event.message).not.toContain("Le client");
    expect(event.message).toContain("opérateur");
    expect(event.actor).toBe("admin");
  });

  it("puts the client's answer on the quote timeline without changing its status", async () => {
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("DELIVERED") as never
    );
    vi.mocked(expedionDal.getByListingId).mockResolvedValue({
      id: "quote-1",
      status: "picked_up",
      firebaseUid: "owner-1",
    } as never);

    await shipmentConfirmationsService.attest({
      shipmentId: "ship-1",
      milestone: "DELIVERED",
      channel: "link",
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(expedionDal.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: "quote-1",
        // The quote's own status, echoed back unchanged.
        status: "picked_up",
        actor: "client",
      })
    );
  });
});

describe("attestFromToken", () => {
  it("refuses a token signed with another secret", async () => {
    const token = mintConfirmationToken("ship-1", "DELIVERED")!;
    process.env.BETTER_AUTH_SECRET = "a-different-secret";

    await expect(
      shipmentConfirmationsService.attestFromToken(token)
    ).rejects.toMatchObject({ code: "INVALID_TOKEN", status: 410 });
  });

  it("records the quote owner as the confirming party", async () => {
    const token = mintConfirmationToken("ship-1", "DELIVERED")!;
    vi.mocked(shipmentsDal.getOwnership).mockResolvedValue(
      ownership("DELIVERED") as never
    );
    vi.mocked(expedionDal.getByListingId).mockResolvedValue({
      id: "quote-1",
      status: "delivered",
      firebaseUid: "owner-1",
    } as never);

    await shipmentConfirmationsService.attestFromToken(token);

    expect(shipmentsDal.createConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "link",
        confirmedByRef: "owner-1",
        // An owner id is not a `user` row, so the foreign key stays empty.
        confirmedByUserId: null,
      })
    );
  });
});

describe("describeToken", () => {
  const shipment = {
    id: "ship-1",
    status: "IN_TRANSIT",
    pickupAddress: "1 rue de Rivoli, Paris",
    dropoffAddress: "5 cours Vitton, Lyon",
    listingId: "listing-1",
    listing: { title: "Lot 42", pickupCity: "Paris", dropoffCity: "Lyon" },
    priceCents: 45000,
    shipper: { id: "shipper-1", name: "Someone", email: "a@b.c" },
  };

  it("says what is being confirmed without leaking the price or the parties", async () => {
    vi.mocked(shipmentsDal.getById).mockResolvedValue(shipment as never);
    vi.mocked(shipmentsDal.getConfirmation).mockResolvedValue(
      undefined as never
    );

    const token = mintConfirmationToken("ship-1", "PICKED_UP")!;
    const subject = await shipmentConfirmationsService.describeToken(token);

    expect(subject).toMatchObject({
      milestone: "PICKED_UP",
      reference: "Lot 42",
      alreadyConfirmed: false,
      confirmable: true,
    });
    // The page is reachable by anyone holding the link.
    expect(Object.keys(subject)).not.toContain("priceCents");
    expect(Object.keys(subject)).not.toContain("shipper");
  });

  it("gives the cities and never the street addresses", async () => {
    // The link lives for 30 days in an SMS and the dropoff on an Expedion job
    // is the client's home address, so the full addresses the shipment holds
    // must not reach this payload.
    vi.mocked(shipmentsDal.getById).mockResolvedValue(shipment as never);
    vi.mocked(shipmentsDal.getConfirmation).mockResolvedValue(
      undefined as never
    );

    const token = mintConfirmationToken("ship-1", "PICKED_UP")!;
    const subject = await shipmentConfirmationsService.describeToken(token);

    expect(subject).toMatchObject({ pickupCity: "Paris", dropoffCity: "Lyon" });
    expect(JSON.stringify(subject)).not.toContain("rue de Rivoli");
    expect(JSON.stringify(subject)).not.toContain("cours Vitton");
  });

  it("omits the route rather than falling back to the addresses", async () => {
    // A fallback to `shipment.pickupAddress` when the listing is missing would
    // reinstate exactly the leak this projection exists to prevent.
    vi.mocked(shipmentsDal.getById).mockResolvedValue({
      ...shipment,
      listing: null,
    } as never);
    vi.mocked(shipmentsDal.getConfirmation).mockResolvedValue(
      undefined as never
    );

    const token = mintConfirmationToken("ship-1", "PICKED_UP")!;
    const subject = await shipmentConfirmationsService.describeToken(token);

    expect(subject.pickupCity).toBeNull();
    expect(JSON.stringify(subject)).not.toContain("rue de Rivoli");
  });

  it("reports a cancelled run as cancelled, not merely unconfirmable", async () => {
    // The page needs to tell the two apart: one promises a further message and
    // the other must not.
    vi.mocked(shipmentsDal.getById).mockResolvedValue({
      ...shipment,
      status: "CANCELLED",
    } as never);
    vi.mocked(shipmentsDal.getConfirmation).mockResolvedValue(
      undefined as never
    );

    const token = mintConfirmationToken("ship-1", "PICKED_UP")!;

    await expect(
      shipmentConfirmationsService.describeToken(token)
    ).resolves.toMatchObject({ confirmable: false, cancelled: true });
  });

  it("reports a milestone the transporter has not reached as not confirmable", async () => {
    vi.mocked(shipmentsDal.getById).mockResolvedValue(shipment as never);
    vi.mocked(shipmentsDal.getConfirmation).mockResolvedValue(
      undefined as never
    );

    const token = mintConfirmationToken("ship-1", "DELIVERED")!;

    await expect(
      shipmentConfirmationsService.describeToken(token)
    ).resolves.toMatchObject({ confirmable: false });
  });
});

describe("requestConfirmation", () => {
  it("emails the quote's client rather than the Expedion system account", async () => {
    vi.mocked(shipmentsDal.getById).mockResolvedValue({
      id: "ship-1",
      listingId: "listing-1",
      dropoffAddress: "5 cours Vitton, Lyon",
      listing: { title: "Lot 42" },
      shipper: { email: "system@expedion.internal", name: "Expedion" },
    } as never);
    vi.mocked(expedionDal.getByListingId).mockResolvedValue({
      id: "quote-1",
      email: "client@example.com",
      firstName: "Camille",
      bordereauNumber: "BX-77",
    } as never);

    await shipmentConfirmationsService.requestConfirmation(
      "ship-1",
      "DELIVERED"
    );

    expect(emailService.sendConfirmationRequestEmail).toHaveBeenCalledWith(
      "client@example.com",
      expect.objectContaining({
        recipientName: "Camille",
        milestone: "DELIVERED",
        reference: "BX-77",
      })
    );
  });

  it("sends nothing when there is no signing secret", async () => {
    delete process.env.BETTER_AUTH_SECRET;

    await shipmentConfirmationsService.requestConfirmation(
      "ship-1",
      "DELIVERED"
    );

    expect(emailService.sendConfirmationRequestEmail).not.toHaveBeenCalled();
  });

  it("never falls back to the system account when the quote has no address", async () => {
    // `shipment.shipper` on an escalated job is the account nobody logs into.
    // Mailing it a working one-tap token would be worse than sending nothing.
    vi.mocked(shipmentsDal.getById).mockResolvedValue({
      id: "ship-1",
      listingId: "listing-1",
      dropoffAddress: "5 cours Vitton, Lyon",
      shipper: { email: "system@expedion.internal", name: "Expedion" },
    } as never);
    vi.mocked(expedionDal.getByListingId).mockResolvedValue({
      id: "quote-1",
      email: null,
      firstName: "Camille",
    } as never);

    await shipmentConfirmationsService.requestConfirmation(
      "ship-1",
      "DELIVERED"
    );

    expect(emailService.sendConfirmationRequestEmail).not.toHaveBeenCalled();
  });

  it("sends nothing when neither the quote nor the shipper has an address", async () => {
    vi.mocked(shipmentsDal.getById).mockResolvedValue({
      id: "ship-1",
      listingId: "listing-1",
      dropoffAddress: "5 cours Vitton, Lyon",
      shipper: { email: null },
    } as never);

    await shipmentConfirmationsService.requestConfirmation(
      "ship-1",
      "PICKED_UP"
    );

    expect(emailService.sendConfirmationRequestEmail).not.toHaveBeenCalled();
  });
});
