import { appUrl, mailbox } from "@/lib/app-url";
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

interface WelcomeEmailProps {
  /** First name to greet by; the mail greets nobody in particular without it. */
  name?: string;
}

/**
 * Sent once, when an account's address is confirmed
 * (`authService.sendWelcomeEmail`). French: the people who sign up here are
 * French clients and drivers.
 *
 * It says only what an account can do the day it is created: post a transport
 * request, and apply to drive from inside the app. Nothing here grants a role.
 */
export const WelcomeEmail = ({ name }: WelcomeEmailProps) => {
  const home = appUrl();

  return (
    <Html lang="fr">
      <Head />
      <Preview>Votre compte EXPEDITOP est prêt.</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              Bienvenue sur <strong>EXPEDITOP</strong>
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              {name ? `Bonjour ${name},` : "Bonjour,"}
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              Votre adresse e-mail est confirmée et votre compte est prêt. Un
              seul compte suffit pour tout faire.
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              <strong>Vous avez quelque chose à faire transporter ?</strong>{" "}
              Décrivez votre demande dès maintenant : des chauffeurs
              vous font leurs offres, et c’est vous qui choisissez.
            </Text>
            <Section className="text-center mt-[24px] mb-[24px]">
              <Link
                href={`${home}/create`}
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
              >
                Demander un transport
              </Link>
            </Section>
            <Text className="text-black text-[14px] leading-[24px]">
              <strong>Vous souhaitez transporter pour nos clients ?</strong>{" "}
              Ouvrez « Devenir chauffeur » dans l’application pour déposer votre
              candidature. Nous vérifions votre dossier avant vos premières
              courses.
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              <Link href={home} className="text-[#000000] underline">
                Ouvrir EXPEDITOP
              </Link>
            </Text>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
              Une question ? Écrivez-nous à {mailbox("support")}.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WelcomeEmail;
