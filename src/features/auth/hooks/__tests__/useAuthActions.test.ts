import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthActions, verifyEmailPath } from "../useAuthActions";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  social: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: mocks.signIn, social: mocks.social },
    signUp: { email: mocks.signUp },
    requestPasswordReset: mocks.requestPasswordReset,
    resetPassword: mocks.resetPassword,
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

describe("useAuthActions.signIn — where to go next", () => {
  const ok = { data: { user: {} }, error: null };

  it("returns to the in-app page the visitor was headed for", async () => {
    mocks.signIn.mockResolvedValue(ok);
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signIn("jean@mail.com", "secret-password", false, "/create?type=moving");
    });

    expect(mocks.push).toHaveBeenCalledWith("/create?type=moving");
  });

  it.each([null, undefined, "//evil.example", "https://evil.example", "/signin"])(
    "falls back to /home for %j",
    async (callbackUrl) => {
      mocks.signIn.mockResolvedValue(ok);
      const { result } = renderHook(() => useAuthActions());

      await act(async () => {
        await result.current.signIn("jean@mail.com", "secret-password", false, callbackUrl);
      });

      expect(mocks.push).toHaveBeenCalledWith("/home");
    }
  );

  it("hands Google the same checked destination", async () => {
    mocks.social.mockResolvedValue({ data: {}, error: null });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signInWithGoogle("/listing/abc");
    });

    expect(mocks.social).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: "/listing/abc" })
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

  it("says a wrong password in a key, never in Better Auth's English", async () => {
    mocks.signIn.mockResolvedValue({
      data: null,
      error: { status: 401, code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
    });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signIn("jean@mail.com", "wrong");
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(result.current.error).toBe("invalidCredentials");
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
    expect(result.current.error).toBe("suspended");
  });

  it("hands the same key back to the page that called it", async () => {
    mocks.signIn.mockResolvedValue({
      data: null,
      error: { status: 401, code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
    });
    const { result } = renderHook(() => useAuthActions());

    let outcome: Awaited<ReturnType<typeof result.current.signIn>> | undefined;
    await act(async () => {
      outcome = await result.current.signIn("jean@mail.com", "wrong");
    });

    expect(outcome).toEqual({ success: false, error: "invalidCredentials" });
  });

  // The limiter answers 429 with a message and no code.
  it("tells too many attempts from a wrong password", async () => {
    mocks.signIn.mockResolvedValue({
      data: null,
      error: { status: 429, message: "Too many requests. Please try again later." },
    });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signIn("jean@mail.com", "secret-password");
    });

    expect(result.current.error).toBe("rateLimited");
  });

  it("names a lost connection as one", async () => {
    mocks.signIn.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useAuthActions());

    let outcome: Awaited<ReturnType<typeof result.current.signIn>> | undefined;
    await act(async () => {
      outcome = await result.current.signIn("jean@mail.com", "secret-password");
    });

    expect(outcome).toEqual({ success: false, error: "network" });
    expect(result.current.error).toBe("network");
    expect(result.current.isLoading).toBe(false);
  });

  it("never lets a sentence it does not know reach the screen", async () => {
    mocks.signIn.mockResolvedValue({
      data: null,
      error: { status: 500, code: "SOMETHING_NEW", message: "Internal exploding error" },
    });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signIn("jean@mail.com", "secret-password");
    });

    expect(result.current.error).toBe("unknown");
  });

  it("clears the last refusal when the person tries again", async () => {
    mocks.signIn
      .mockResolvedValueOnce({
        data: null,
        error: { status: 401, code: "INVALID_EMAIL_OR_PASSWORD", message: "x" },
      })
      .mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signIn("jean@mail.com", "wrong");
    });
    expect(result.current.error).toBe("invalidCredentials");

    await act(async () => {
      await result.current.signIn("jean@mail.com", "right");
    });
    expect(result.current.error).toBeNull();
    expect(mocks.push).toHaveBeenCalledWith("/home");
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

  it("sends an address that is already registered to sign in or reset", async () => {
    mocks.signUp.mockResolvedValue({
      data: null,
      error: { status: 422, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "User already exists. Use another email." },
    });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signUp("jean@mail.com", "secret-password", {
        firstName: "Jean",
        lastName: "Dupont",
      });
    });

    expect(mocks.push).not.toHaveBeenCalled();
    expect(result.current.error).toBe("accountExists");
  });

  it.each([
    ["PASSWORD_TOO_SHORT", "passwordTooShort"],
    ["PASSWORD_TOO_LONG", "passwordTooLong"],
    ["INVALID_EMAIL", "invalidEmail"],
  ])("maps the server's %s refusal to %s", async (code, key) => {
    mocks.signUp.mockResolvedValue({ data: null, error: { status: 400, code, message: "x" } });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.signUp("jean@mail.com", "pw", { firstName: "J", lastName: "D" });
    });

    expect(result.current.error).toBe(key);
  });
});

describe("useAuthActions, the other forms", () => {
  it("reports a refused reset request as a key", async () => {
    mocks.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { status: 429, message: "Too many requests. Please try again later." },
    });
    const { result } = renderHook(() => useAuthActions());

    let outcome: Awaited<ReturnType<typeof result.current.requestPasswordReset>> | undefined;
    await act(async () => {
      outcome = await result.current.requestPasswordReset("jean@mail.com");
    });

    expect(outcome).toEqual({ success: false, error: "rateLimited" });
  });

  it("tells the reset page when its link is dead", async () => {
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { status: 400, code: "INVALID_TOKEN", message: "Invalid token" },
    });
    const { result } = renderHook(() => useAuthActions());

    let outcome: Awaited<ReturnType<typeof result.current.resetPassword>> | undefined;
    await act(async () => {
      outcome = await result.current.resetPassword("tok", "new-password-1");
    });

    expect(outcome).toEqual({ success: false, error: "invalidToken" });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("keeps a successful reset on its way to sign-in", async () => {
    mocks.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    const { result } = renderHook(() => useAuthActions());

    await act(async () => {
      await result.current.resetPassword("tok", "new-password-1");
    });

    expect(mocks.push).toHaveBeenCalledWith("/signin");
  });

  it("no longer drops a Google refusal on the floor", async () => {
    mocks.social.mockResolvedValue({
      data: null,
      error: { status: 500, message: "Provider not configured" },
    });
    const { result } = renderHook(() => useAuthActions());

    let outcome: Awaited<ReturnType<typeof result.current.signInWithGoogle>> | undefined;
    await act(async () => {
      outcome = await result.current.signInWithGoogle();
    });

    expect(outcome).toEqual({ success: false, error: "unknown" });
  });
});
