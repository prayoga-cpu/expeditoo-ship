import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { ContactSubject } from "@/server/dto/contact.dto";

interface ContactMessageEmailProps {
  name: string;
  email: string;
  company?: string;
  subject: ContactSubject;
  message: string;
  /** Present when the sender was signed in, so an operator can open the thread. */
  threadUrl?: string;
}

/**
 * The operator-facing copy of a public contact submission. English only, and
 * deliberately so: this is internal mail to the support desk, not a message to
 * the visitor, so it does not follow the visitor's locale.
 */
export function ContactMessageEmail({
  name,
  email,
  company,
  subject,
  message,
  threadUrl,
}: ContactMessageEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Contact — ${subject} — ${name}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>New contact enquiry</Heading>

          <Text style={meta}>
            <strong>From:</strong> {name} &lt;{email}&gt;
          </Text>
          {company ? (
            <Text style={meta}>
              <strong>Company:</strong> {company}
            </Text>
          ) : null}
          <Text style={meta}>
            <strong>Subject:</strong> {subject}
          </Text>

          <Hr style={rule} />

          {/* Split by hand: react-email renders a <Text> as one paragraph, so
              a multi-line enquiry would otherwise arrive as a single block. */}
          {message.split("\n").map((line, index) => (
            <Text key={`${index}-${line}`} style={body}>
              {line}
            </Text>
          ))}

          <Hr style={rule} />

          <Text style={footer}>
            {threadUrl
              ? `This sender has an Expeditoo account — the message is also in their support thread: ${threadUrl}`
              : "This sender has no Expeditoo account, so there is no support thread. Reply to this email to answer them."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "24px",
  maxWidth: "560px",
};

const h1 = {
  color: "#111419",
  fontSize: "20px",
  fontWeight: "600",
  margin: "0 0 16px",
};

const meta = {
  color: "#4e5866",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 4px",
};

const body = {
  color: "#111419",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 10px",
};

const rule = { borderColor: "#e6e8ec", margin: "18px 0" };

const footer = {
  color: "#8a93a0",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
};
