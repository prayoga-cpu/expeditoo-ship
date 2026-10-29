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
 * The driver hears about every payout (client_feedback_2026_10_29_spec.md
 * §N6): when a delivery adds to what they are owed, and when a transfer is
 * recorded as made. French, like the rest of the driver's mail.
 */

export interface PayoutEmailProps {
  kind: "earned" | "paid";
  recipientName?: string | null;
  amountLabel: string;
  /** The job a delivery paid for, on `earned`. */
  jobTitle?: string | null;
  /** The bank transfer's reference, on `paid`. */
  transferReference?: string | null;
  earningsUrl: string;
}

export const PayoutEmail = ({
  kind,
  recipientName,
  amountLabel,
  jobTitle,
  transferReference,
  earningsUrl,
}: PayoutEmailProps) => {
  const title =
    kind === "earned"
      ? `${amountLabel} ajoutés à votre solde`
      : `Virement de ${amountLabel} effectué`;

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              {title}
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              {recipientName ? `Bonjour ${recipientName},` : "Bonjour,"}
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              {kind === "earned"
                ? `La livraison${jobTitle ? ` « ${jobTitle} »` : ""} est confirmée : ${amountLabel} vous sont dus, déduction faite de la commission. Vous pouvez demander leur versement depuis « Mes paiements ».`
                : `Votre demande de retrait a été réglée : ${amountLabel} ont été virés sur votre compte.`}
            </Text>
            {kind === "paid" && transferReference ? (
              <Text className="text-[#666666] text-[13px] m-0">
                Référence du virement : {transferReference}
              </Text>
            ) : null}
            <Section className="text-center mt-[32px] mb-[32px]">
              <Link
                href={earningsUrl}
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              >
                Mes paiements
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default PayoutEmail;
