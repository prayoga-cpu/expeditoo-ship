import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Link,
  Hr,
} from "@react-email/components";
import * as React from "react";

/**
 * Confirms a direct transport request went live on the board.
 *
 * Not a payment receipt — no money has moved yet on this inlet
 * (payment_at_booking_spec.md §4: the charge happens when a carrier is
 * chosen, not when the job is posted). French, matching
 * `ConfirmationRequestEmail.tsx`'s style; the recipient is the requester who
 * just used `/create`, the one surface in this app that is still French/EN
 * dual but whose transactional mail has always shipped French-only.
 */

interface TransportRequestReceivedEmailProps {
  recipientName?: string | null;
  listingTitle: string;
  pickupCity: string;
  dropoffCity: string;
  budgetLabel: string;
  listingUrl: string;
}

export const TransportRequestReceivedEmail = ({
  recipientName,
  listingTitle,
  pickupCity,
  dropoffCity,
  budgetLabel,
  listingUrl,
}: TransportRequestReceivedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Votre demande de transport est en ligne</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              Votre demande de transport est en ligne
            </Heading>

            <Text className="text-black text-[14px] leading-[24px]">
              {recipientName ? `Bonjour ${recipientName},` : "Bonjour,"}
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              Les transporteurs peuvent maintenant proposer un prix pour votre
              demande. Vous choisirez vous-même qui s&apos;en charge.
            </Text>

            <Section className="my-4">
              <Text className="text-[#666666] text-[13px] m-0 font-semibold">
                {listingTitle}
              </Text>
              <Text className="text-[#666666] text-[13px] m-0 mt-1">
                {pickupCity} → {dropoffCity}
              </Text>
              <Text className="text-[#666666] text-[13px] m-0 mt-1">
                Budget : {budgetLabel}
              </Text>
            </Section>

            <Section className="text-center mt-[32px] mb-[32px]">
              <Link
                href={listingUrl}
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              >
                Voir ma demande
              </Link>
            </Section>

            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
              Vous serez notifié dès qu&apos;un transporteur propose un prix.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default TransportRequestReceivedEmail;
