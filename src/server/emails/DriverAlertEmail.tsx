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
 * The email twin of the driver's texts (client_feedback_2026_10_29_spec.md §N7,
 * decision of 30 October: « email now, flip the SMS env vars later »). Names
 * the job and links to it — never the client's message itself.
 */

export interface DriverAlertEmailProps {
  kind: "message" | "accepted";
  recipientName?: string | null;
  jobTitle: string;
  url: string;
}

export const DriverAlertEmail = ({ kind, recipientName, jobTitle, url }: DriverAlertEmailProps) => {
  const title =
    kind === "message"
      ? `Nouveau message au sujet de « ${jobTitle} »`
      : `Votre offre pour « ${jobTitle} » est acceptée`;

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
              {kind === "message"
                ? "Votre client vous a écrit. Répondez-lui depuis la conversation."
                : "Le client a retenu votre offre. Retrouvez les détails de la mission et préparez le retrait."}
            </Text>
            <Section className="text-center mt-[32px] mb-[32px]">
              <Link
                href={url}
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              >
                {kind === "message" ? "Ouvrir la conversation" : "Voir la mission"}
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DriverAlertEmail;
