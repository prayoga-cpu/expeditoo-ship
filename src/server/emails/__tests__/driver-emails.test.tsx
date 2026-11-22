import { render } from "@react-email/components";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DriverApplicationSubmittedEmail } from "../DriverApplicationSubmittedEmail";
import { DriverApprovedEmail } from "../DriverApprovedEmail";
import { emailService } from "@/server/services/email.service";

/**
 * The two mails around a driver's approval, as their readers get them
 * (driver_types_spec.md §3 and §9): the admin's alert, which leads with the
 * type, and the driver's congratulation, which says what that kind can do now.
 */

const alert = {
  applicantName: "Paul Martin",
  companyName: "Paul Martin EI",
  city: "Lyon",
  reviewUrl: "https://app.test/admin/drivers?tab=applications&file=c1",
};

describe("sendDriverApplicationSubmittedEmail", () => {
  const sendEmail = vi.spyOn(emailService, "sendEmail");

  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue(true);
  });

  it.each([
    ["private", "Nouveau dossier chauffeur — Particulier (interne) : Paul Martin"],
    ["professional", "Nouveau dossier chauffeur — Professionnel : Paul Martin"],
  ] as const)("leads the subject of a %s file with its type", async (kind, subject) => {
    await emailService.sendDriverApplicationSubmittedEmail("admin@example.com", { ...alert, kind });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin@example.com", subject })
    );
  });

  it("links the button straight to the file", async () => {
    await emailService.sendDriverApplicationSubmittedEmail("admin@example.com", {
      ...alert,
      kind: "private",
    });

    const { html } = sendEmail.mock.calls[0][0];
    expect(html).toContain('href="https://app.test/admin/drivers?tab=applications&amp;file=c1"');
  });
});

describe("DriverApplicationSubmittedEmail", () => {
  it("names an in-house file as such, and does not say the applicant will make offers", async () => {
    const text = await render(DriverApplicationSubmittedEmail({ ...alert, kind: "private" }), {
      plainText: true,
    });

    expect(text).toContain("Type : Particulier (interne)");
    expect(text).toContain("Paul Martin");
    expect(text).toMatch(/attend seulement votre validation/);
    expect(text).not.toMatch(/proposer des offres/);
    expect(text).not.toMatch(/Chauffeur interne\b|Transporteur\b/);
  });

  it("names a professional file as such", async () => {
    const text = await render(DriverApplicationSubmittedEmail({ ...alert, kind: "professional" }), {
      plainText: true,
    });

    expect(text).toContain("Type : Professionnel");
    expect(text).toMatch(/proposer des offres/);
  });
});

describe("DriverApprovedEmail", () => {
  it("congratulates an in-house driver and sends them to « Livraisons », never to offers", async () => {
    const element = DriverApprovedEmail({
      name: "Jeanne",
      kind: "private",
      actionUrl: "https://app.test/driver/shipments",
    });
    const text = await render(element, { plainText: true });
    const html = await render(element);

    expect(text).toMatch(/félicitations/i);
    expect(text).toContain("Bonjour Jeanne,");
    expect(text).toMatch(/Expeditop vous attribue vos courses/);
    expect(text).toContain("« Livraisons »");
    expect(text).toMatch(/Ouvrir mes livraisons/i);
    expect(text).not.toMatch(/offres|missions disponibles/);
    expect(html).toContain('href="https://app.test/driver/shipments"');
  });

  it("congratulates a professional and sends them to the missions board", async () => {
    const element = DriverApprovedEmail({
      name: "Paul",
      kind: "professional",
      actionUrl: "https://app.test/expedion",
    });
    const text = await render(element, { plainText: true });
    const html = await render(element);

    expect(text).toMatch(/félicitations/i);
    expect(text).toMatch(/Consultez les missions disponibles et faites vos offres/);
    expect(text).toMatch(/Voir les missions/i);
    expect(text).not.toContain("« Livraisons »");
    expect(html).toContain('href="https://app.test/expedion"');
  });

  it("is in French and greets nobody in particular without a name", async () => {
    const text = await render(
      DriverApprovedEmail({ kind: "professional", actionUrl: "https://app.test/expedion" }),
      { plainText: true }
    );

    expect(text).toContain("Bonjour,");
    expect(text).not.toContain("undefined");
    expect(text).not.toMatch(/Congratulations|approved|Hello/);
  });
});

describe("sendDriverApprovedEmail", () => {
  const sendEmail = vi.spyOn(emailService, "sendEmail");

  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue(true);
  });

  it.each([
    ["private", "Félicitations, vous êtes chauffeur Expeditop"],
    ["professional", "Félicitations, votre dossier chauffeur est approuvé"],
  ] as const)("sends a %s driver a French subject", async (kind, subject) => {
    await emailService.sendDriverApprovedEmail("driver@example.com", {
      kind,
      actionUrl: "https://app.test/",
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "driver@example.com", subject })
    );
  });
});
