import { render } from "@react-email/components";
import { afterEach, describe, expect, it } from "vitest";

import { VerificationEmail } from "../VerificationEmail";
import { WelcomeEmail } from "../WelcomeEmail";

/** The two mails an account receives on its way in, as the recipient reads them. */

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

describe("WelcomeEmail", () => {
  it("is in French and says what the account can do now", async () => {
    const text = await render(WelcomeEmail({ name: "Jeanne" }), { plainText: true });

    expect(text).toContain("Bonjour Jeanne,");
    expect(text).toContain("Demander un transport");
    expect(text).toContain("Devenir chauffeur");
    expect(text).not.toMatch(/Welcome|Get Started|Hello/);
  });

  it("links into the app through appUrl()", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test/";

    const html = await render(WelcomeEmail({ name: "Jeanne" }));

    expect(html).toContain('href="https://app.test/create"');
    expect(html).toContain('href="https://app.test"');
  });

  it("greets nobody in particular without a name", async () => {
    const text = await render(WelcomeEmail({}), { plainText: true });

    expect(text).toContain("Bonjour,");
    expect(text).not.toContain("undefined");
  });
});

describe("VerificationEmail", () => {
  const verificationUrl = "https://app.test/api/auth/verify-email?token=abc";

  it("is in French, for the product the account belongs to", async () => {
    const text = await render(
      VerificationEmail({ verificationUrl, userName: "Jean", productName: "Expedion" }),
      { plainText: true }
    );

    expect(text).toContain("Bonjour Jean,");
    expect(text).toContain("Confirmer mon adresse e-mail");
    expect(text).toContain("Expedion");
    expect(text).not.toContain("EXPEDITOP");
    expect(text).not.toMatch(/Verify|Welcome|Hi /);
  });

  it("carries the link twice: the button, and the copyable line", async () => {
    const html = await render(VerificationEmail({ verificationUrl }));

    expect(html).toContain(`href="${verificationUrl}"`);
    expect(html).toContain("Bonjour,");
  });
});
