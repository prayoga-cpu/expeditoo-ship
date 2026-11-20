import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAIL_DOMAIN,
  PRODUCTION_HOST,
  PRODUCTION_ORIGIN,
  appUrl,
  mailbox,
} from "../app-url";

afterEach(() => vi.unstubAllEnvs());

describe("appUrl", () => {
  it("is the variable when it is set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    expect(appUrl()).toBe("http://localhost:3000");
  });

  it("drops a trailing slash so a path can be appended", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.expeditop.fr/");
    expect(appUrl()).toBe("https://www.expeditop.fr");
  });

  it("falls back to the production origin, never to a domain we do not own", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(appUrl()).toBe("https://www.expeditop.fr");
    expect(appUrl()).toBe(PRODUCTION_ORIGIN);
  });
});

describe("the domain constants agree", () => {
  it("origin, host and mail domain name the same site", () => {
    expect(PRODUCTION_ORIGIN).toBe(`https://${PRODUCTION_HOST}`);
    expect(PRODUCTION_HOST).toBe(`www.${MAIL_DOMAIN}`);
  });

  it("composes a mailbox on the mail domain", () => {
    expect(mailbox("support")).toBe("support@expeditop.fr");
  });
});
