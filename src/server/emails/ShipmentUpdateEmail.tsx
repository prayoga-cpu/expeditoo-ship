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
 * Tells the requester their shipment reached a stage — pickup, in transit or
 * delivered, the same three statuses `shipment.service.ts` already sends an
 * in-app notification for. French, matching `TransportRequestReceivedEmail`'s
 * style: this is the same requester's mail, same transactional register.
 *
 * Only the statuses `shipment.service.ts` can actually reach are named here —
 * `ASSIGNED` and `CANCELLED` never call this, and there is no `DELAYED`
 * status on `shipments` to report.
 */

type ShipmentStage = "PICKED_UP" | "IN_TRANSIT" | "DELIVERED";

interface ShipmentUpdateEmailProps {
  recipientName?: string | null;
  listingTitle: string;
  shipmentId: string;
  status: ShipmentStage;
  deliveryAddress?: string;
}

const stageConfig: Record<ShipmentStage, { emoji: string; title: string }> = {
  PICKED_UP: { emoji: "📦", title: "Colis récupéré" },
  IN_TRANSIT: { emoji: "🚚", title: "En cours de livraison" },
  DELIVERED: { emoji: "✅", title: "Livré" },
};

const stageMessage: Record<ShipmentStage, string> = {
  PICKED_UP:
    "Le transporteur vient de récupérer votre envoi. Il est en route.",
  IN_TRANSIT: "Votre envoi est en cours de livraison.",
  DELIVERED: "Votre envoi a été livré.",
};

export const ShipmentUpdateEmail = ({
  recipientName,
  listingTitle,
  shipmentId,
  status,
  deliveryAddress,
}: ShipmentUpdateEmailProps) => {
  const config = stageConfig[status];

  return (
    <Html>
      <Head />
      <Preview>
        {listingTitle} — {config.title}
      </Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              {config.emoji} {config.title}
            </Heading>

            <Text className="text-black text-[14px] leading-[24px]">
              {recipientName ? `Bonjour ${recipientName},` : "Bonjour,"}
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              {stageMessage[status]}
            </Text>

            <Section className="bg-[#f9f9f9] rounded-lg p-4 my-4">
              <Text className="text-black text-[14px] font-semibold m-0">
                {listingTitle}
              </Text>
              {deliveryAddress && status !== "DELIVERED" && (
                <>
                  <Hr className="border border-solid border-[#eaeaea] my-3" />
                  <Text className="text-[#666666] text-[13px] m-0">
                    Livraison : {deliveryAddress}
                  </Text>
                </>
              )}
            </Section>

            <Section className="text-center mt-[32px] mb-[32px]">
              <Link
                href={`${process.env.NEXT_PUBLIC_APP_URL || "https://expeditoo.com"}/deliveries/${shipmentId}`}
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              >
                Suivre ma livraison
              </Link>
            </Section>

            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
              Une question sur votre livraison ? Contactez le transporteur
              directement depuis la messagerie.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ShipmentUpdateEmail;
