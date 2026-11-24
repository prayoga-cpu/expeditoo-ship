import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import VerifyEmailPage from "../page";

/**
 * The verify-email screen's way out (client feedback, 2.91.0 #12): a resend
 * button that sends through Better Auth, says what happened, and never leaves
 * a failure with nothing to press.
 */

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  send: vi.fn(),
  verifyCode: vi.fn(),
}));
let currentQuery = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
  useSearchParams: () => currentQuery,
}));

// Keys are echoed with their values, so the assertions name the copy slot and
// what was put in it rather than a sentence that lives in messages/*.json.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { sendVerificationEmail: mocks.send },
}));

vi.mock("@/features/auth/hooks/useAuthActions", () => ({
  useAuthActions: () => ({ verifyEmail: vi.fn() }),
}));

vi.mock("@/features/auth/api/email-code.api", () => ({
  verifyEmailCode: mocks.verifyCode,
}));

function renderPage(query = "") {
  currentQuery = new URLSearchParams(query);
  return render(<VerifyEmailPage />);
}

const resendButton = () => screen.getByRole("button", { name: /^resend/ });

afterEach(() => vi.clearAllMocks());

describe("VerifyEmailPage — resend", () => {
  it("names the address it was handed and asks for none", () => {
    renderPage("email=jean%40mail.com");

    expect(
      screen.getByText('subtitleWithEmail {"email":"jean@mail.com"}')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("emailLabel")).not.toBeInTheDocument();
    expect(resendButton()).toBeEnabled();
  });

  it("sends through Better Auth with the address and a callback", async () => {
    mocks.send.mockResolvedValue({ data: { status: true }, error: null });
    renderPage("email=jean%40mail.com");

    fireEvent.click(resendButton());

    await screen.findByText(/^resent/);
    expect(mocks.send).toHaveBeenCalledWith({
      email: "jean@mail.com",
      callbackURL: "/signin?verified=true",
    });
  });

  it("rests the button for a minute after a send that went through", async () => {
    mocks.send.mockResolvedValue({ data: { status: true }, error: null });
    renderPage("email=jean%40mail.com");

    fireEvent.click(resendButton());

    const waiting = await screen.findByRole("button", {
      name: 'resendIn {"seconds":60}',
    });
    expect(waiting).toBeDisabled();
  });

  it("says a send failed, names support, and keeps the button live", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { status: 500, code: "VERIFICATION_EMAIL_NOT_SENT" },
    });
    renderPage("email=jean%40mail.com");

    fireEvent.click(resendButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("resendFailed");
    expect(alert).toHaveTextContent("support@expeditop.fr");
    expect(screen.queryByText(/^resent/)).not.toBeInTheDocument();
    expect(resendButton()).toBeEnabled();
  });

  it("treats a request that never left as a failure too", async () => {
    mocks.send.mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage("email=jean%40mail.com");

    fireEvent.click(resendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("resendFailed");
    expect(resendButton()).toBeEnabled();
  });

  it("asks to wait when the server says too many", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { status: 429 } });
    renderPage("email=jean%40mail.com");

    fireEvent.click(resendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "resendRateLimited"
    );
    expect(
      screen.getByRole("button", { name: 'resendIn {"seconds":60}' })
    ).toBeDisabled();
  });

  it("shows the sending state while the request is out", async () => {
    let settle: (value: unknown) => void = () => {};
    mocks.send.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    renderPage("email=jean%40mail.com");

    fireEvent.click(resendButton());

    expect(screen.getByRole("button", { name: "resending" })).toBeDisabled();
    await act(async () => settle({ data: { status: true }, error: null }));
  });
});

describe("VerifyEmailPage — without an address", () => {
  it("asks for one, and refuses to send to something that is not one", () => {
    renderPage("");

    fireEvent.change(screen.getByLabelText("emailLabel"), {
      target: { value: "not-an-address" },
    });
    fireEvent.click(resendButton());

    expect(screen.getByText("emailInvalid")).toBeInTheDocument();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends to the address typed", async () => {
    mocks.send.mockResolvedValue({ data: { status: true }, error: null });
    renderPage("");

    fireEvent.change(screen.getByLabelText("emailLabel"), {
      target: { value: " jean@mail.com " },
    });
    fireEvent.click(resendButton());

    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith(
        expect.objectContaining({ email: "jean@mail.com" })
      )
    );
  });
});

describe("VerifyEmailPage — how the visitor got here", () => {
  it("says a new link was just sent after a refused sign-in", () => {
    renderPage("email=jean%40mail.com&from=signin");

    expect(screen.getByText("fromSignIn")).toBeInTheDocument();
  });

  it("says nothing of the kind after a sign-up", () => {
    renderPage("email=jean%40mail.com");

    expect(screen.queryByText("fromSignIn")).not.toBeInTheDocument();
  });

  it("offers a new link, not a new account, when the mail's link failed", () => {
    renderPage("linkError=1");

    expect(screen.getByText("failedTitle")).toBeInTheDocument();
    expect(screen.getByText("linkFailedBody")).toBeInTheDocument();
    expect(screen.getByLabelText("emailLabel")).toBeInTheDocument();
    expect(resendButton()).toBeEnabled();
  });

  it("always leaves a way back to sign-in", () => {
    renderPage("email=jean%40mail.com");

    fireEvent.click(screen.getByRole("button", { name: "backToLogin" }));

    expect(mocks.push).toHaveBeenCalledWith("/signin");
  });
});

describe("VerifyEmailPage — the code from the mail (email_access_code_spec.md §5)", () => {
  const codeField = () => screen.getByLabelText("code.label");
  const validate = () => screen.getByRole("button", { name: "code.submit" });

  function typeCode(value: string) {
    fireEvent.change(codeField(), { target: { value } });
  }

  it("asks for it in one field the phone can fill from the mail", () => {
    renderPage("email=jean%40mail.com");

    const field = codeField();
    expect(field).toHaveAttribute("inputmode", "numeric");
    expect(field).toHaveAttribute("autocomplete", "one-time-code");
    // No `maxlength`: the browser would cut « 123 456 » to « 123 45 » before
    // the field could reduce it to digits (found on dev, 2026-11-24).
    expect(field).not.toHaveAttribute("maxlength");
    // « Valider » comes before the resend block.
    expect(
      validate().compareDocumentPosition(resendButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("takes a pasted « 123 456 » as one code", () => {
    renderPage("email=jean%40mail.com");

    fireEvent.paste(codeField(), {
      clipboardData: { getData: () => "123 456" },
    });

    expect(codeField()).toHaveValue("123456");
  });

  it("takes « 123 456 » inserted in one go (dictation, a suggestion) as one code", () => {
    renderPage("email=jean%40mail.com");

    typeCode("123 456");

    expect(codeField()).toHaveValue("123456");
  });

  it("never holds more than six digits", () => {
    renderPage("email=jean%40mail.com");

    typeCode("1234567890");

    expect(codeField()).toHaveValue("123456");
  });

  it("keeps digits only while typing", () => {
    renderPage("email=jean%40mail.com");

    typeCode("12a-3");

    expect(codeField()).toHaveValue("123");
  });

  it("asks for all six digits before asking the server", () => {
    renderPage("email=jean%40mail.com");

    typeCode("123");
    fireEvent.click(validate());

    expect(screen.getByText("code.incomplete")).toBeInTheDocument();
    expect(mocks.verifyCode).not.toHaveBeenCalled();
  });

  it("goes to sign-in with the address filled in once the code is right", async () => {
    mocks.verifyCode.mockResolvedValue({ status: "verified", email: "jean@mail.com" });
    renderPage("email=jean%40mail.com");

    typeCode("123456");
    fireEvent.click(validate());

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/signin?verified=true&email=jean%40mail.com"
      )
    );
    expect(mocks.verifyCode).toHaveBeenCalledWith("jean@mail.com", "123456");
    expect(screen.getByRole("status")).toHaveTextContent("code.verified");
  });

  it("keeps the page the sign-in was headed to", async () => {
    mocks.verifyCode.mockResolvedValue({ status: "verified", email: "jean@mail.com" });
    renderPage("email=jean%40mail.com&from=signin&callbackUrl=%2Flisting%2Fabc");

    typeCode("123456");
    fireEvent.click(validate());

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/signin?verified=true&email=jean%40mail.com&callbackUrl=%2Flisting%2Fabc"
      )
    );
  });

  it("says how many tries are left on a wrong code", async () => {
    mocks.verifyCode.mockResolvedValue({ status: "invalid", attemptsLeft: 3 });
    renderPage("email=jean%40mail.com");

    typeCode("000000");
    fireEvent.click(validate());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'code.invalid {"count":3}'
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(validate()).toBeEnabled();
  });

  it.each([
    ["expired", "code.expired"],
    ["tooManyAttempts", "code.tooManyAttempts"],
  ])("sends the person to a new code when it is %s", async (status, copy) => {
    mocks.verifyCode.mockResolvedValue({ status });
    renderPage("email=jean%40mail.com");

    typeCode("123456");
    fireEvent.click(validate());

    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    expect(resendButton()).toHaveFocus();
    expect(codeField()).toHaveValue("");
  });

  it("names support and keeps « Valider » live when the check fails", async () => {
    mocks.verifyCode.mockResolvedValue({ status: "failed" });
    renderPage("email=jean%40mail.com");

    typeCode("123456");
    fireEvent.click(validate());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("code.failed");
    expect(alert).toHaveTextContent("support@expeditop.fr");
    expect(validate()).toBeEnabled();
  });

  it("clears the last answer as soon as a new code is typed", async () => {
    mocks.verifyCode.mockResolvedValue({ status: "invalid", attemptsLeft: 4 });
    renderPage("email=jean%40mail.com");

    typeCode("000000");
    fireEvent.click(validate());
    await screen.findByRole("alert");

    typeCode("1");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses the address typed on the page when it was not handed one", async () => {
    mocks.verifyCode.mockResolvedValue({ status: "verified", email: "jean@mail.com" });
    renderPage("");

    typeCode("123456");
    fireEvent.click(validate());
    expect(screen.getByText("emailInvalid")).toBeInTheDocument();
    expect(mocks.verifyCode).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("emailLabel"), {
      target: { value: " jean@mail.com " },
    });
    fireEvent.click(validate());

    await waitFor(() =>
      expect(mocks.verifyCode).toHaveBeenCalledWith("jean@mail.com", "123456")
    );
  });

  it("lets a handed address that is not one be corrected", () => {
    renderPage("email=jean");

    expect(screen.getByLabelText("emailLabel")).toHaveValue("jean");
  });

  // A failed link is where people most need the other way in.
  it("offers the code after a link that failed, too", () => {
    renderPage("linkError=1");

    expect(codeField()).toBeInTheDocument();
    expect(validate()).toBeEnabled();
  });
});
