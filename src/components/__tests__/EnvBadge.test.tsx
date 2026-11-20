import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

async function renderIn(appEnv: string) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({ APP_ENV: appEnv }));
  const { EnvBadge } = await import("../EnvBadge");
  render(<EnvBadge />);
}

describe("EnvBadge", () => {
  afterEach(() => vi.doUnmock("@/lib/env"));

  it("marks a preview deployment", async () => {
    await renderIn("preview");
    expect(screen.getByTestId("env-badge")).toHaveTextContent("Dev");
  });

  it.each(["production", "local"])("renders nothing in %s", async (appEnv) => {
    await renderIn(appEnv);
    expect(screen.queryByTestId("env-badge")).toBeNull();
  });
});
