"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Mail } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { useAuthActions } from "@/features/auth/hooks/useAuthActions";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { InlineLoader } from "@/components/ui/page-loader";

type VerificationState = "idle" | "verifying" | "success" | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail } = useAuthActions();
  const t = useTranslations("auth.verifyEmail");

  const [state, setState] = useState<VerificationState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      handleVerification(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleVerification = async (verificationToken: string) => {
    setState("verifying");
    setErrorMessage(null);

    const result = await verifyEmail(verificationToken);

    if (result.success) {
      setState("success");

      // Wait a moment for Better Auth to complete auto-signin
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh router to get updated session
      router.refresh();

      // A brand-new account: send it to onboarding rather than straight to
      // the dashboard, so it can pick what it's here for. Better Auth should
      // have already auto-signed it in.
      router.push("/welcome");
    } else {
      setState("error");
      setErrorMessage(result.error || t("failedFallback"));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-background py-8 px-4 overflow-hidden relative">
      {/* Animated gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <BrandMark size={40} />
          <span className="text-2xl font-bold text-foreground">EXPEDITOP</span>
        </div>

        {/* Verification Card */}
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8">
          {/* Idle State - No Token */}
          {state === "idle" && !token && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
                {t("title")}
              </h1>
              <p className="text-muted-foreground mb-6 text-center">
                {t("subtitle")}
              </p>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
                <p className="text-primary text-sm">
                  <strong>{t("didntReceive")}</strong>
                  <br />
                  {t("checkSpam")}
                </p>
              </div>

              <Button
                onClick={() => router.push("/signin")}
                variant="outline"
                className="w-full rounded-xl border-border/50 hover:bg-muted/50 text-foreground py-6 font-semibold transition-colors"
              >
                {t("backToLogin")}
              </Button>
            </>
          )}

          {/* Verifying State */}
          {state === "verifying" && (
            <>
              <div className="flex justify-center mb-6">
                {/* Use a larger loader for the main verification state */}
                <InlineLoader size="md" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
                {t("verifyingTitle")}
              </h1>
              <p className="text-muted-foreground text-center">
                {t("verifyingBody")}
              </p>
            </>
          )}

          {/* Success State */}
          {state === "success" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-primary" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
                {t("successTitle")}
              </h1>
              <p className="text-muted-foreground mb-6 text-center">
                {t("successBody")}
              </p>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
                <p className="text-primary text-sm text-center">
                  {t("redirecting")}
                </p>
              </div>

              <Button
                onClick={() => router.push("/welcome")}
                className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-semibold transition-colors"
              >
                {t("continue")}
              </Button>
            </>
          )}

          {/* Error State */}
          {state === "error" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
                {t("failedTitle")}
              </h1>
              <p className="text-muted-foreground mb-6 text-center">
                {t("failedBody")}
              </p>

              {errorMessage && (
                <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm text-center">
                    {errorMessage}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/signup")}
                  className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-semibold transition-colors"
                >
                  {t("signUpAgain")}
                </Button>

                <Button
                  onClick={() => router.push("/signin")}
                  variant="outline"
                  className="w-full rounded-xl border-border/50 hover:bg-muted/50 text-foreground py-6 font-semibold transition-colors"
                >
                  {t("backToLogin")}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Help Text */}
        <p className="text-center text-muted-foreground text-sm mt-6">
          {t("needHelp")}{" "}
          <a
            href="mailto:support@expeditop.fr"
            className="text-primary hover:text-primary/80 font-medium"
          >
            {t("contactSupport")}
          </a>
        </p>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const t = useTranslations("auth.verifyEmail");

  return (
    <Suspense fallback={<div>{t("loading")}</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
