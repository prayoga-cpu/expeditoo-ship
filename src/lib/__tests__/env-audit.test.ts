import { describe, expect, it } from "vitest";
import { auditEnv, MUST_DIFFER, REQUIRED } from "../env-audit";

const separate = (key: string) => [
  { key, target: ["production"] },
  { key, target: ["preview"] },
];

describe("auditEnv", () => {
  it("flags a must-differ key stored once for production and preview", () => {
    const audit = auditEnv([
      { key: "R2_BUCKET_NAME", target: ["production", "preview"] },
      ...separate("STRIPE_SECRET_KEY"),
    ]);

    expect(audit.shared).toEqual(["R2_BUCKET_NAME"]);
  });

  it("does not flag a key that is harmless to share", () => {
    const audit = auditEnv([
      { key: "OPENAI_API_KEY", target: ["production", "preview"] },
    ]);

    expect(audit.shared).toEqual([]);
  });

  it("passes a fully separated project", () => {
    const audit = auditEnv(MUST_DIFFER.flatMap(separate));

    expect(audit.shared).toEqual([]);
    expect(audit.missing).toEqual({ production: [], preview: [] });
  });

  it("names the required keys a scope lacks", () => {
    const audit = auditEnv([{ key: "CRON_SECRET", target: "production" }]);

    expect(audit.missing.production).not.toContain("CRON_SECRET");
    expect(audit.missing.preview).toContain("CRON_SECRET");
  });

  it("only requires keys it also keeps apart", () => {
    for (const key of REQUIRED) expect(MUST_DIFFER).toContain(key);
  });
});
