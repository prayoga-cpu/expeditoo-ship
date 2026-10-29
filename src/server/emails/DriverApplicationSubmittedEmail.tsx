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
} from "@react-email/components";
import * as React from "react";

/**
 * Tells an admin a driver application is waiting for review
 * (client_feedback_2026_10_29_spec.md §REQ-07). French, like the rest of the
 * staff-facing mail. Names the applicant and the company only — no SIRET, no
 * documents: those are read in the back office, never forwarded.
 */

interface DriverApplicationSubmittedEmailProps {
  applicantName: string;
  companyName: string;
  city: string;
  reviewUrl: string;
}

export const DriverApplicationSubmittedEmail = ({
  applicantName,
  companyName,
  city,
  reviewUrl,
}: DriverApplicationSubmittedEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Nouveau dossier chauffeur à examiner</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              Nouveau dossier chauffeur
            </Heading>

            <Text className="text-black text-[14px] leading-[24px]">
              Un chauffeur vient de soumettre son dossier. Il attend votre
              décision avant de pouvoir proposer des offres.
            </Text>

            <Section className="my-4">
              <Text className="text-[#666666] text-[13px] m-0 font-semibold">
                {applicantName}
              </Text>
              <Text className="text-[#666666] text-[13px] m-0 mt-1">
                {companyName}
              </Text>
              <Text className="text-[#666666] text-[13px] m-0 mt-1">{city}</Text>
            </Section>

            <Section className="text-center mt-[32px] mb-[32px]">
              <Link
                href={reviewUrl}
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              >
                Examiner le dossier
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DriverApplicationSubmittedEmail;
