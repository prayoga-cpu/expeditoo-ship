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
 * Carries the document itself, attached, to the client who paid.
 *
 * French, like the PDF it carries and like every other client-facing mail here.
 * What replaced: an English `<h1>Your invoice is ready</h1>` with a link to the
 * profile screen and no attachment, so "sent by email" meant the client still
 * had to sign in and go looking (invoice_at_payment_spec.md §7.1).
 *
 * The heading follows the document rather than asserting anything of its own:
 * while the issuer's legal identifiers are unset the attachment is a *reçu de
 * paiement*, not a facture, and this mail must not call it one.
 */

interface InvoiceDocumentEmailProps {
    recipientName?: string | null;
    documentTitle: string;
    documentNumber: string;
    amountLabel: string;
    isCreditNote: boolean;
    jobTitle?: string | null;
    /** The document an avoir corrects, so the mail names it as the PDF does. */
    correctsDocumentNumber?: string | null;
    invoicesUrl: string;
}

export const InvoiceDocumentEmail = ({
    recipientName,
    documentTitle,
    documentNumber,
    amountLabel,
    isCreditNote,
    jobTitle,
    correctsDocumentNumber,
    invoicesUrl,
}: InvoiceDocumentEmailProps) => (
    <Html>
        <Head />
        <Preview>
            {documentTitle} {documentNumber} — {amountLabel}
        </Preview>
        <Tailwind>
            <Body className="bg-white my-auto mx-auto font-sans px-2">
                <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
                    <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                        {documentTitle} {documentNumber}
                    </Heading>

                    <Text className="text-black text-[14px] leading-[24px]">
                        {recipientName ? `Bonjour ${recipientName},` : "Bonjour,"}
                    </Text>

                    <Text className="text-black text-[14px] leading-[24px]">
                        {isCreditNote
                            ? "Votre paiement vous a été remboursé. L'avoir correspondant est joint à ce message."
                            : "Votre paiement a bien été enregistré. Le document correspondant est joint à ce message, au format PDF."}
                    </Text>

                    <Section className="my-4">
                        <Text className="text-[#666666] text-[13px] m-0">
                            Document : {documentNumber}
                        </Text>
                        <Text className="text-[#666666] text-[13px] m-0 mt-1">
                            Montant : {amountLabel}
                        </Text>
                        {correctsDocumentNumber && (
                            <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                Avoir sur : {correctsDocumentNumber}
                            </Text>
                        )}
                        {jobTitle && (
                            <Text className="text-[#666666] text-[13px] m-0 mt-1">
                                Transport : {jobTitle}
                            </Text>
                        )}
                    </Section>

                    <Section className="text-center mt-[32px] mb-[32px]">
                        <Link
                            href={invoicesUrl}
                            className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                        >
                            Voir mes documents
                        </Link>
                    </Section>

                    <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                    <Text className="text-[#666666] text-[12px] leading-[24px]">
                        Vous pouvez retrouver et télécharger ce document à tout moment
                        depuis votre profil, et le recevoir à nouveau par e-mail.
                    </Text>
                </Container>
            </Body>
        </Tailwind>
    </Html>
);

export default InvoiceDocumentEmail;
