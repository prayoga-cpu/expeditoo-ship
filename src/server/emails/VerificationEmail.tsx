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
   * EXPEDITOO and Expedion share one Better Auth instance, so this template
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
  userName = "there",
  productName = "EXPEDITOO",
}: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your {productName} account</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to {productName}!</Heading>
          <Text style={text}>Hi {userName},</Text>
          <Text style={text}>
            Thank you for signing up. Please verify your email address to get
            started with {productName}.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={verificationUrl}>
              Verify Email Address
            </Button>
          </Section>
          <Text style={footer}>
            If you didn't create an account with {productName}, you can safely
            ignore this email.
          </Text>
          <Text style={footer}>
            Or copy and paste this link: {verificationUrl}
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
