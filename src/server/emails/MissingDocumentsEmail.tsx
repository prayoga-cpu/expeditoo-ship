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
 * Tells a driver applicant which documents their file still lacks
 * (client feedback 2026-11-06, B05). French first, English beneath: the account
 * does not carry a language the mail can read, and a missing document is worth
 * saying twice rather than in the wrong one.
 */

interface MissingDocumentsEmailProps {
  applicantName: string;
  missingFr: string[];
  missingEn: string[];
  applicationUrl: string;
}

export const MissingDocumentsEmail = ({
  applicantName,
  missingFr,
  missingEn,
  applicationUrl,
}: MissingDocumentsEmailProps) => (
  <Html>
    <Head />
    <Preview>Il manque des documents à votre dossier chauffeur</Preview>
    <Tailwind>
      <Body className="bg-white my-auto mx-auto font-sans px-2">
        <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
          <Heading className="text-black text-[22px] font-normal text-center p-0 my-[24px] mx-0">
            Votre dossier chauffeur est presque complet
          </Heading>
          <Text className="text-black text-[14px] leading-[24px]">
            Bonjour {applicantName}, nous avons bien reçu votre dossier. Pour
            qu&apos;il puisse être examiné, il manque :
          </Text>
          <Section className="my-2">
            {missingFr.map((label) => (
              <Text key={label} className="text-black text-[14px] m-0 leading-[22px]">
                • {label}
              </Text>
            ))}
          </Section>

          <Text className="text-[#666666] text-[13px] leading-[22px] mt-[20px] mb-0">
            Your driver file has been received. To be reviewed, it still needs:
          </Text>
          <Section className="my-2">
            {missingEn.map((label) => (
              <Text key={label} className="text-[#666666] text-[13px] m-0 leading-[20px]">
                • {label}
              </Text>
            ))}
          </Section>

          <Section className="text-center mt-[28px] mb-[28px]">
            <Link
              href={applicationUrl}
              className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
            >
              Compléter mon dossier · Complete my file
            </Link>
          </Section>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default MissingDocumentsEmail;
