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

interface DriverInvitationEmailProps {
  /** The set-password link; it is the whole point of the mail. */
  inviteUrl: string;
  userName?: string;
  productName?: string;
}

/**
 * « Vous êtes invité à rejoindre l'équipe de chauffeurs » — sent when an admin
 * adds an in-house driver whose email has no account yet
 * (driver_types_spec.md §4). The account and the driver file already exist;
 * the link only lets the person choose a password.
 */
export function DriverInvitationEmail({
  inviteUrl,
  userName,
  productName = "EXPEDITOP",
}: DriverInvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Vous êtes invité à rejoindre les chauffeurs {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Bienvenue dans l’équipe {productName}</Heading>
          <Text style={text}>{userName ? `Bonjour ${userName},` : "Bonjour,"}</Text>
          <Text style={text}>
            {productName} vous a ajouté comme chauffeur de l’équipe. Votre compte est
            créé : il ne vous reste qu’à choisir votre mot de passe pour vous
            connecter et suivre les courses qui vous seront confiées.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={inviteUrl}>
              Choisir mon mot de passe
            </Button>
          </Section>
          <Text style={warning}>Ce lien expire dans 1 heure.</Text>
          <Text style={footer}>
            Il expire ? Sur la page de connexion, « Mot de passe oublié » vous en
            enverra un nouveau.
          </Text>
          <Text style={footer}>Ou copiez ce lien dans votre navigateur : {inviteUrl}</Text>
        </Container>
      </Body>
    </Html>
  );
}

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
const text = { color: "#333", fontSize: "16px", lineHeight: "26px", padding: "0 48px" };
const buttonContainer = { padding: "27px 48px" };
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
const footer = { color: "#666", fontSize: "14px", lineHeight: "24px", padding: "0 48px" };
