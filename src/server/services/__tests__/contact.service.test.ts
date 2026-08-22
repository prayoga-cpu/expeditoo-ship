import { describe, it, expect, vi, beforeEach } from "vitest";
import { contactService, ContactError } from "../contact.service";
import { emailService } from "@/server/services/email.service";
import { messagesService } from "@/server/services/messages.service";

vi.mock("@/server/services/email.service", () => ({
  emailService: { sendEmail: vi.fn() },
}));

vi.mock("@/server/services/messages.service", () => ({
  messagesService: {
    getOrCreateSupportConversation: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

const VALID = {
  name: "Camille Roux",
  email: "Camille@Example.COM",
  subject: "carrier" as const,
  message: "I drive a 12m3 van out of Lyon and would like to apply.",
};

const SENDER = { id: "user_1", name: "Camille Roux", image: null };

describe("contactService.submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(emailService.sendEmail).mockResolvedValue(true);
    vi.mocked(messagesService.getOrCreateSupportConversation).mockResolvedValue({
      conversationId: "conv_1",
      created: true,
    });
    vi.mocked(messagesService.sendMessage).mockResolvedValue({
      // Only the shape the service touches; it forwards nothing from here.
      message: { id: "msg_1" },
    } as never);
  });

  it("emails the support inbox and reports delivery", async () => {
    const result = await contactService.submit(VALID);

    expect(result).toEqual({ delivered: true, threadOpened: false });
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);

    const sent = vi.mocked(emailService.sendEmail).mock.calls[0][0];
    expect(sent.subject).toContain("Camille Roux");
    // Normalised by the DTO, so an operator's reply goes to a usable address.
    expect(sent.replyTo).toBe("camille@example.com");
  });

  it("opens no support thread for an anonymous sender", async () => {
    await contactService.submit(VALID);

    expect(
      messagesService.getOrCreateSupportConversation
    ).not.toHaveBeenCalled();
  });

  it("also posts into the sender's support thread when signed in", async () => {
    const result = await contactService.submit(VALID, { sender: SENDER });

    expect(result.threadOpened).toBe(true);
    expect(messagesService.getOrCreateSupportConversation).toHaveBeenCalledWith(
      "user_1"
    );

    const [, input] = vi.mocked(messagesService.sendMessage).mock.calls[0];
    expect(input.conversationId).toBe("conv_1");
    expect(input.content).toContain(VALID.message);
    // The operator reading the thread needs to know how it arrived.
    expect(input.content).toContain("[Contact form — carrier]");
  });

  it("still delivers when the support thread cannot be opened", async () => {
    vi.mocked(messagesService.sendMessage).mockRejectedValue(
      new Error("conversation insert failed")
    );

    const result = await contactService.submit(VALID, { sender: SENDER });

    // The email is the delivery guarantee: a chat failure must not lose the
    // visitor's message.
    expect(result).toEqual({ delivered: true, threadOpened: false });
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("opens no thread on a borrowed session", async () => {
    const result = await contactService.submit(VALID, {
      sender: SENDER,
      impersonated: true,
    });

    expect(result.threadOpened).toBe(false);
    expect(
      messagesService.getOrCreateSupportConversation
    ).not.toHaveBeenCalled();
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("throws rather than claiming delivery when the email fails", async () => {
    vi.mocked(emailService.sendEmail).mockRejectedValue(new Error("resend down"));

    await expect(contactService.submit(VALID)).rejects.toMatchObject({
      code: "CONTACT_DELIVERY_FAILED",
      status: 502,
    });
    await expect(contactService.submit(VALID)).rejects.toBeInstanceOf(
      ContactError
    );
  });

  it("rejects a message that is too short", async () => {
    await expect(
      contactService.submit({ ...VALID, message: "hi" })
    ).rejects.toThrow();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid address", async () => {
    await expect(
      contactService.submit({ ...VALID, email: "not-an-address" })
    ).rejects.toThrow();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });
});
