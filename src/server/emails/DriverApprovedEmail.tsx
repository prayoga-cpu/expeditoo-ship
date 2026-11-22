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
import type { CarrierKind } from "@/lib/carrier-kind";

export interface DriverApprovedEmailProps {
  /** The account's name; the mail greets nobody in particular without it. */
  name?: string;
  kind: CarrierKind;
  /** « Livraisons » for an in-house driver, the missions board for a carrier. */
  actionUrl: string;
  productName?: string;
}

/**
 * What each kind can do the day it is approved, and nothing it cannot: an
 * in-house driver is assigned runs and never bids; an outside carrier reads
 * the board and makes offers (driver_types_spec.md §6).
 */
const COPY: Record<CarrierKind, { lead: string; next: string; button: string }> = {
  private: {
    lead: "Votre dossier est validé : vous faites désormais partie des chauffeurs Expeditop.",
    next: "Vous n'avez rien à chercher : Expeditop vous attribue vos courses. Dès qu'une course vous est confiée, vous la retrouvez dans « Livraisons », avec les adresses et les étapes à valider.",
    button: "Ouvrir mes livraisons",
  },
  professional: {
    lead: "Votre dossier est approuvé : vous pouvez dès maintenant travailler avec Expeditop.",
    next: "Consultez les missions disponibles et faites vos offres : prix, véhicule et créneaux. Pensez à garder vos documents et votre flotte à jour.",
    button: "Voir les missions",
  },
};

/**
 * « Félicitations » — sent once, when an admin approves a driver's file
 * (`carrierService.approve`, `grantRole`). French, like the rest of the mail
 * drivers receive. Its sending never decides the approval: the service calls
 * it in its own try, after the commit (driver_types_spec.md §9).
 */
export function DriverApprovedEmail({
  name,
  kind,
  actionUrl,
  productName = "EXPEDITOP",
}: DriverApprovedEmailProps) {
  const copy = COPY[kind];

  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Félicitations, votre dossier chauffeur ${productName} est approuvé`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Félicitations !</Heading>
          <Text style={text}>{name ? `Bonjour ${name},` : "Bonjour,"}</Text>
          <Text style={text}>{copy.lead}</Text>
          <Text style={text}>{copy.next}</Text>
          <Section style={buttonContainer}>
            <Button style={button} href={actionUrl}>
              {copy.button}
            </Button>
          </Section>
          <Text style={footer}>Ou copiez ce lien dans votre navigateur : {actionUrl}</Text>
          <Text style={footer}>
            Si le mode Chauffeur n’apparaît pas encore dans votre menu d’accès,
            déconnectez-vous puis reconnectez-vous.
          </Text>
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
const footer = { color: "#666", fontSize: "14px", lineHeight: "24px", padding: "0 48px" };

export default DriverApprovedEmail;
