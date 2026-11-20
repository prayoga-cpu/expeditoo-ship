import { describe, expect, it } from "vitest";

import { readConversationFilter, writeConversationFilter } from "../useConversationFilter";

/** The filter lives in `?filter=`, so Back restores it (client feedback 2026-11-19, #26). */
describe("conversation filter in the URL", () => {
  it("reads a known filter, and « all » for anything else", () => {
    expect(readConversationFilter("?filter=active")).toBe("active");
    expect(readConversationFilter("?filter=none")).toBe("none");
    expect(readConversationFilter("")).toBe("all");
    expect(readConversationFilter("?filter=bogus")).toBe("all");
  });

  it("writes it, keeping the other parameters", () => {
    expect(writeConversationFilter("", "done")).toBe("?filter=done");
    expect(writeConversationFilter("?x=1&filter=active", "waiting")).toBe("?x=1&filter=waiting");
  });

  it("drops the parameter for « all », leaving no bare « ? »", () => {
    expect(writeConversationFilter("?filter=done", "all")).toBe("");
    expect(writeConversationFilter("?x=1&filter=done", "all")).toBe("?x=1");
  });
});
