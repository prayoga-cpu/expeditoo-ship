import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 2.96.0 #36. The realtime provider was `dynamic(…, { ssr: false })` wrapped
 * *around* the app: the server rendered nothing inside it, and when the Ably
 * client connected the app was re-parented under `ably/react`'s provider —
 * every page unmounted and mounted again a beat after sign-in resolved.
 * The connection is now a sibling that only writes the client into context.
 */

const fakeClient = { connection: { state: "connected" } };

// Stands in for the lazily loaded `AblyConnection`: it connects on mount.
vi.mock("next/dynamic", () => ({
  default: () =>
    function FakeConnection({ setClient }: { setClient: (client: unknown) => void }) {
      useEffect(() => setClient(fakeClient), [setClient]);
      return null;
    },
}));

import { LazyAblyProvider } from "../LazyAblyProvider";
import { useAblyClientContext } from "../ably-context";

let mounts = 0;

function Page() {
  const client = useAblyClientContext();
  useEffect(() => {
    mounts += 1;
  }, []);
  return <p data-testid="page">{client ? "live" : "offline"}</p>;
}

beforeEach(() => {
  mounts = 0;
});

describe("LazyAblyProvider", () => {
  it("renders the app on the server", () => {
    const html = renderToString(
      <LazyAblyProvider>
        <Page />
      </LazyAblyProvider>
    );
    expect(html).toContain("offline");
  });

  it("hands the client to the app without remounting it", () => {
    render(
      <LazyAblyProvider>
        <Page />
      </LazyAblyProvider>
    );

    expect(screen.getByTestId("page")).toHaveTextContent("live");
    expect(mounts).toBe(1);
  });
});
