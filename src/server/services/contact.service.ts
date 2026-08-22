import { render } from "@react-email/components";
import {
  contactSubmitSchema,
  type ContactSubmitInput,
  type ContactSubmitResult,
} from "@/server/dto/contact.dto";
import { ContactMessageEmail } from "@/server/emails/ContactMessageEmail";
import { emailService } from "@/server/services/email.service";
import { messagesService } from "@/server/services/messages.service";

export class ContactError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ContactError";
  }
}

export interface ContactSender {
  id: string;
  name: string | null;
  image: string | null;
}

export interface ContactContext {
  /** The signed-in visitor, when there is one. The form is public. */
  sender?: ContactSender | null;
  /** True when an admin is riding a borrowed session. */
  impersonated?: boolean;
}

/** Where enquiries land. Overridable so a preview deploy can point elsewhere. */
function contactInbox(): string {
  return process.env.CONTACT_INBOX_EMAIL || "support@expeditoo.com";
}

function threadUrl(conversationId: string): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return base ? `${base}/admin/support/${conversationId}` : undefined;
}

/**
 * The message as it reads inside the support thread.
 *
 * The visitor's own words are kept verbatim and the routing detail is prefixed,
 * because an operator opening the thread sees this next to ordinary chat
 * messages and needs to know it arrived through the public form.
 */
function threadBody(input: ContactSubmitInput): string {
  const lines: string[] = [`[Contact form — ${input.subject}]`];
  if (input.company) lines.push(`Company: ${input.company}`);
  lines.push(`Reply-to: ${input.email}`, "", input.message);

  return lines.join("\n");
}

/**
 * Post the enquiry into the sender's own support thread as well as emailing it.
 *
 * Separate from `submit` so its failure is containable: the email is the
 * delivery guarantee, and a chat insert that fails must not lose a visitor's
 * message. Returns the conversation id, or null when no thread was opened.
 */
async function openSupportThread(
  input: ContactSubmitInput,
  sender: ContactSender
): Promise<string | null> {
  try {
    const { conversationId } =
      await messagesService.getOrCreateSupportConversation(sender.id);

    await messagesService.sendMessage(
      sender.id,
      { conversationId, content: threadBody(input) },
      // `sendMessage` wants a display name for the realtime fan-out. An
      // account can carry a null one, so the name typed into the form stands
      // in rather than the thread showing an unnamed sender.
      { name: sender.name ?? input.name, image: sender.image }
    );

    return conversationId;
  } catch (error) {
    console.error("Contact form: support thread not opened:", error);
    return null;
  }
}

export const contactService = {
  /**
   * Deliver a public contact enquiry.
   *
   * Two destinations, ranked. The email to the support inbox is what makes the
   * submission true; the in-product thread is an upgrade available only when
   * the sender has an account, because a conversation participant is a foreign
   * key into `user` and an anonymous visitor has no row to point at.
   */
  async submit(
    input: ContactSubmitInput,
    context: ContactContext = {}
  ): Promise<ContactSubmitResult> {
    const validated = contactSubmitSchema.parse(input);

    // A borrowed session performs no automatic writes of its own
    // (docs/specs/admin_user_management_spec.md). Posting into the borrowed
    // user's support thread would put words in their mouth.
    const sender = context.impersonated ? null : context.sender;

    const conversationId = sender
      ? await openSupportThread(validated, sender)
      : null;

    const html = await render(
      ContactMessageEmail({
        name: validated.name,
        email: validated.email,
        company: validated.company,
        subject: validated.subject,
        message: validated.message,
        threadUrl: conversationId ? threadUrl(conversationId) : undefined,
      })
    );

    try {
      await emailService.sendEmail({
        to: contactInbox(),
        subject: `[Contact — ${validated.subject}] ${validated.name}`,
        html,
        // So an operator hitting reply answers the visitor rather than the
        // platform's own sending address.
        replyTo: validated.email,
      });
    } catch (error) {
      console.error("Contact form: delivery failed:", error);
      throw new ContactError(
        "CONTACT_DELIVERY_FAILED",
        "Your message could not be delivered. Please try again shortly.",
        502
      );
    }

    return { delivered: true, threadOpened: conversationId !== null };
  },
};
