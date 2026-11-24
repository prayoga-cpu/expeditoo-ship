import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../auth-context";

/**
 * 2.96.0 #36. Pages render on the server now, where there is never a session.
 * When the session store answered before part of the page had hydrated, that
 * part hydrated with the user already in it, did not match the server's HTML,
 * and React rendered it again from scratch. `useAuth` hydrates with what the
 * server had and switches straight after.
 */

const session = { data: null as unknown, isPending: true };

vi.mock("@/lib/auth-client", () => ({
  useSession: () => session,
}));

function Probe() {
  const { user, isLoading } = useAuth();
  return <p>{isLoading ? "loading" : user ? `hello ${user.name}` : "signed out"}</p>;
}

describe("useAuth across hydration", () => {
  it("hydrates as the server rendered, then shows the session", async () => {
    session.data = null;
    session.isPending = true;
    const html = renderToString(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(html).toContain("loading");

    // The session has already answered by the time this part hydrates.
    session.data = { user: { id: "u1", name: "Ada", roles: [] }, session: { id: "s1" } };
    session.isPending = false;

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      hydrateRoot(
        container,
        <AuthProvider>
          <Probe />
        </AuthProvider>,
        { onRecoverableError }
      );
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydrat|did not match/i);
    expect(container).toHaveTextContent("hello Ada");
    consoleError.mockRestore();
    container.remove();
  });
});
