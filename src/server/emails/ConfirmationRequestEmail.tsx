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
 * Asks the client to attest a milestone the transporter has just recorded.
 *
 * French only, and deliberately: the recipients are Expedion clients, and the
 * SMS this email doubles is French too. The button is a one-tap signed link
 * that records the confirmation and nothing else — it cannot move the
 * transport or the money (transport_status_confirmation_spec.md §6).
 */

interface ConfirmationRequestEmailProps {
    recipientName?: string | null;
    milestone: "PICKED_UP" | "DELIVERED";
    confirmUrl: string;
    reference?: string | null;
    dropoffAddress?: string | null;
}

const COPY = {
    PICKED_UP: {
        heading: "Votre lot a été retiré",
        lead: "Le transporteur nous indique avoir effectué le retrait. Confirmez-le pour que les deux parties soient d'accord sur ce qui s'est passé.",
        cta: "Confirmer le retrait",
        preview: "Confirmez le retrait de votre lot",
    },
    DELIVERED: {
        heading: "Votre lot a été livré",
        lead: "Le transporteur nous indique avoir livré votre lot. Confirmez la bonne réception pour clôturer le transport.",
        cta: "Confirmer la réception",
        preview: "Confirmez la réception de votre lot",
    },
} as const;

export const ConfirmationRequestEmail = ({
    recipientName,
    milestone,
    confirmUrl,
    reference,
    dropoffAddress,
}: ConfirmationRequestEmailProps) => {
    const copy = COPY[milestone];

    return (
        <Html>
            <Head />
            <Preview>{copy.preview}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans px-2">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            {copy.heading}
                        </Heading>

                        <Text className="text-black text-[14px] leading-[24px]">
                            {recipientName ? `Bonjour ${recipientName},` : "Bonjour,"}
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            {copy.lead}
                        </Text>

                        {reference && (
                            <Section className="my-4">
                                <Text className="text-[#666666] text-[13px] m-0">
                                    Transport : {reference}
                                </Text>
                                {dropoffAddress && milestone !== "DELIVERED" && (
                                    <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                        Livraison à : {dropoffAddress}
                                    </Text>
                                )}
                            </Section>
                        )}

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                href={confirmUrl}
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                            >
                                {copy.cta}
                            </Link>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Text className="text-[#666666] text-[12px] leading-[24px]">
                            Si quelque chose ne s&apos;est pas passé comme prévu, ne
                            confirmez pas et contactez notre support : nous ferons le
                            point avec le transporteur.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default ConfirmationRequestEmail;
