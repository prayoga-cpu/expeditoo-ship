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
import { carrierKindLabel, type CarrierKind } from "@/lib/carrier-kind";

/**
 * Tells an admin a driver application is waiting for review
 * (client_feedback_2026_10_29_spec.md §REQ-07). French, like the rest of the
 * staff-facing mail. Names the applicant and the company only — no SIRET, no
 * documents: those are read in the back office, never forwarded.
 */

export interface DriverApplicationSubmittedEmailProps {
  applicantName: string;
  companyName: string;
  city: string;
  /**
   * `private` reads « Particulier (interne) », `professional`
   * « Professionnel » — through `carrierKindLabel`, the one vocabulary the
   * admin screens use too (driver_types_spec.md §1).
   */
  kind: CarrierKind;
  /** Opens the file itself: `/admin/drivers?tab=applications&file=<id>`. */
  reviewUrl: string;
}

export const DriverApplicationSubmittedEmail = ({
  applicantName,
  companyName,
  city,
  kind,
  reviewUrl,
}: DriverApplicationSubmittedEmailProps) => {
  const kindLabel = carrierKindLabel(kind);

  return (
    <Html>
      <Head />
      <Preview>{`Nouveau dossier chauffeur à examiner — ${kindLabel}`}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              Nouveau dossier chauffeur
            </Heading>

            <Text className="text-black text-[14px] leading-[24px]">
              {kind === "private"
                ? "Un chauffeur interne vient de soumettre son dossier. Il n'a ni société ni documents à fournir : il attend seulement votre validation pour recevoir ses courses."
                : "Un transporteur professionnel vient de soumettre son dossier. Il attend votre décision avant de pouvoir proposer des offres."}
            </Text>

            <Section className="my-4">
              <Text className="text-black text-[13px] m-0 font-semibold">
                Type : {kindLabel}
              </Text>
              <Text className="text-[#666666] text-[13px] m-0 mt-1 font-semibold">
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
