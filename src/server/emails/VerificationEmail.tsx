import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface VerificationEmailProps {
  verificationUrl: string;
  userName?: string;
  /**
   * Which product this account belongs to, as the recipient knows it.
   *
   * EXPEDITOP and Expedion share one Better Auth instance, so this template
   * also greets auction buyers who have never heard of a freight marketplace.
   * The caller resolves the name from `user.origin`
   * (src/server/services/auth.service.ts); the default keeps every existing
   * caller, and every mail sent for an account with no Expedion app to point
   * at, reading exactly as it did before.
   */
  productName?: string;
}

export function VerificationEmail({
  verificationUrl,
  userName,
  productName = "EXPEDITOP",
}: VerificationEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Confirmez votre adresse e-mail {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* French, like the reset mail: the people who sign up here are
              French clients and drivers. */}
          <Heading style={h1}>Confirmez votre adresse e-mail</Heading>
          <Text style={text}>{userName ? `Bonjour ${userName},` : "Bonjour,"}</Text>
          <Text style={text}>
            Merci de votre inscription sur {productName}. Il reste une étape :
            confirmer que cette adresse est bien la vôtre.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={verificationUrl}>
              Confirmer mon adresse e-mail
            </Button>
          </Section>
          <Text style={footer}>Ce lien expire dans 1 heure.</Text>
          <Text style={footer}>
            Si vous n’avez pas créé de compte {productName}, ignorez simplement
            cet e-mail.
          </Text>
          <Text style={footer}>
            Ou copiez ce lien dans votre navigateur : {verificationUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0 48px",
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  padding: "0 48px",
};

const buttonContainer = {
  padding: "27px 48px",
};

const button = {
  backgroundColor: "#000",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "16px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "100%",
  padding: "12px 24px",
};

const footer = {
  color: "#666",
  fontSize: "14px",
  lineHeight: "24px",
  padding: "0 48px",
};
