import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthActions, verifyEmailPath } from "../useAuthActions";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: mocks.signIn },
    signUp: { email: mocks.signUp },
  },
}));

afterEach(() => vi.clearAllMocks());

describe("verifyEmailPath", () => {
  it("carries the address, encoded", () => {
    expect(verifyEmailPath(" jean+test@mail.com ")).toBe(
      "/verify-email?email=jean%2Btest%40mail.com"
    );
  });

  it("says when it was a sign-in that sent the visitor", () => {
    expect(verifyEmailPath("jean@mail.com", "signin")).toBe(
      "/verify-email?email=jean%40mail.com&from=signin"
    );
  });
});

describe("useAuthActions.signIn", () => {
  // Better Auth answers 403 « Email not verified ». Printed raw it was an
  // English dead end; the verify screen has the resend button.
  it("sends an unconfirmed address to the verify screen, with no error to print", async () => {
    mocks.signIn.mockResolvedValue({
      data: null,
      error: { status: 403, code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
    });
    const { result } = renderHook(() => useAuthActions());

    let outcome: Awaited<ReturnType<typeof result.current.signIn>> | undefined;
    await act(async () => {
      outcome = await result.current.signIn("jean@mail.com", "secret-password");
    });

    expect(mocks.push).toHaveBeenCalledWith(
      "/verify-email?email=jean%40mail.com&from=signin"
    );
    expect(outcome).toEqual({ success: false });
    expect(result.current.error).toBeNull();
  });

  it("still reports any other refusal", async () => {
    mocks.signIn.mockResolvedValue({
      data: null,
      error: { status: 401, code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
    });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signIn("jean@mail.com", "wrong");
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Invalid email or password");
  });

  // A suspended account is a 403 too; it must not be told to check its inbox.
  it("does not take a suspension for an unconfirmed address", async () => {
    mocks.signIn.mockResolvedValue({
      data: null,
      error: { status: 403, code: "BANNED_USER", message: "This account has been suspended." },
    });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signIn("jean@mail.com", "secret-password");
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(result.current.error).toBe("This account has been suspended.");
  });
});

describe("useAuthActions.signUp", () => {
  it("lands on the verify screen with the address the resend button needs", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signUp("jean@mail.com", "secret-password", {
        firstName: "Jean",
        lastName: "Dupont",
      });
    });

    expect(mocks.push).toHaveBeenCalledWith("/verify-email?email=jean%40mail.com");
  });
});
