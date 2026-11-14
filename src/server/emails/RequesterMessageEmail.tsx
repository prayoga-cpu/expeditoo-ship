import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";

/**
 * The requester is told a driver wrote to them (requester_message_alert_spec.md).
 * The mirror of `DriverAlertEmail`'s « message » kind: it names the job and
 * links to the conversation — never the driver's words, which belong in the app.
 */

export interface RequesterMessageEmailProps {
  recipientName?: string | null;
  jobTitle: string;
  url: string;
}

export const RequesterMessageEmail = ({
  recipientName,
  jobTitle,
  url,
}: RequesterMessageEmailProps) => {
  const title = `Un transporteur vous a écrit au sujet de « ${jobTitle} »`;

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Heading className="text-black text-[22px] font-normal text-center p-0 my-[30px] mx-0">
              {title}
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              {recipientName ? `Bonjour ${recipientName},` : "Bonjour,"}
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              Un transporteur a répondu à votre demande. Lisez son message et répondez-lui
              depuis la conversation.
            </Text>
            <Section className="text-center mt-[32px] mb-[32px]">
              <Link
                href={url}
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              >
                Ouvrir la conversation
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default RequesterMessageEmail;
