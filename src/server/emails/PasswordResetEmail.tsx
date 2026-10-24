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

interface PasswordResetEmailProps {
  resetUrl: string;
  userName?: string;
  /**
   * Which product this account belongs to, as the recipient knows it.
   *
   * The two products share one Better Auth instance and one password, so this
   * mail goes out to Expedion clients as readily as to EXPEDITOO carriers, and
   * a reset mail branded for the wrong product reads like a phishing attempt at
   * the one moment a user is most right to be suspicious. The caller resolves
   * the name from `user.origin` (src/server/services/auth.service.ts); the
   * default preserves the wording every existing caller already sends.
   */
  productName?: string;
}

export function PasswordResetEmail({
  resetUrl,
  userName,
  productName = "EXPEDITOO",
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Réinitialisez votre mot de passe {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* French: the people who reset a password here are French clients
              and drivers (client feedback 2026-10-21, §C4). */}
          <Heading style={h1}>Réinitialisation de votre mot de passe</Heading>
          <Text style={text}>{userName ? `Bonjour ${userName},` : "Bonjour,"}</Text>
          <Text style={text}>
            Nous avons reçu une demande de réinitialisation du mot de passe de
            votre compte {productName}.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Choisir un nouveau mot de passe
            </Button>
          </Section>
          <Text style={warning}>Ce lien expire dans 1 heure.</Text>
          <Text style={footer}>
            Si vous n’êtes pas à l’origine de cette demande, ignorez simplement
            cet e-mail : votre mot de passe reste inchangé.
          </Text>
          <Text style={footer}>Ou copiez ce lien dans votre navigateur : {resetUrl}</Text>
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

const warning = {
  color: "#e74c3c",
  fontSize: "14px",
  lineHeight: "24px",
  padding: "0 48px",
  fontWeight: "bold",
};

const footer = {
  color: "#666",
  fontSize: "14px",
  lineHeight: "24px",
  padding: "0 48px",
};
