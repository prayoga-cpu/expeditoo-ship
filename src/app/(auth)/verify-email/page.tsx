"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Mail } from "lucide-react";
import { useAuthActions } from "@/features/auth/hooks/useAuthActions";
import { signInAfterVerification } from "@/features/auth/hooks/useEmailCodeVerification";
import { useTranslations } from "next-intl";
import { InlineLoader } from "@/components/ui/page-loader";
import { VerifyEmailActions, AuthNote, AuthShell } from "@/features/auth/ui";
import { mailbox } from "@/lib/app-url";

type VerificationState = "idle" | "verifying" | "success" | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail } = useAuthActions();
  const t = useTranslations("auth.verifyEmail");

  const [state, setState] = useState<VerificationState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = searchParams.get("token");
  // Sign-up and a refused sign-in both hand the address over, so the code
  // field and the resend button work without asking for it again.
  const email = searchParams.get("email")?.trim() || undefined;
  // Where the refused sign-in was headed; checked before it is ever followed.
  const callbackUrl = searchParams.get("callbackUrl");
  // A sign-in refused for an unconfirmed address: Better Auth mailed a fresh
  // code and link on the way out (`sendOnSignIn`, src/lib/auth.ts).
  const fromSignIn = searchParams.get("from") === "signin";
  // The mail's link was followed and verified nothing (expired, already
  // used); the sign-in page forwards that here.
  const linkFailed = searchParams.get("linkError") !== null;

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
      // Verifying signs nobody in (`autoSignInAfterVerification` is off), so
      // this used to land on /welcome with no session, under « nous vous
      // connectons ». Sign-in is where a verified address goes next.
      router.push(signInAfterVerification(email, callbackUrl));
    } else {
      setState("error");
      // Never Better Auth's own sentence: it is English and names a token.
      setErrorMessage(t("failedFallback"));
    }
  };

  return (
    <AuthShell
      below={
        <p className="mt-8 text-sm text-muted-foreground">
          {t("needHelp")}{" "}
          <a
            href={`mailto:${mailbox("support")}`}
            className="text-primary hover:text-primary/80 font-medium"
          >
            {t("contactSupport")}
          </a>
        </p>
      }
    >
          {/* Idle State - No Token */}
          {state === "idle" && !token && (
            <>
              <div className="mb-5">
                {linkFailed ? (
                    <XCircle className="size-8 text-destructive" />
                  ) : (
                    <Mail className="size-8 text-primary" />
                  )}
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                {linkFailed ? t("failedTitle") : t("title")}
              </h1>
              <p className="text-muted-foreground mb-6 break-words">
                {linkFailed
                  ? t("linkFailedBody")
                  : email
                    ? t("subtitleWithEmail", { email })
                    : t("subtitle")}
              </p>

              {fromSignIn && !linkFailed && (
                <AuthNote className="mb-4">{t("fromSignIn")}</AuthNote>
              )}

              <div className="space-y-3">
                <VerifyEmailActions initialEmail={email} callbackUrl={callbackUrl}>
                  {!linkFailed && (
                    <AuthNote>
                      <strong className="font-semibold text-foreground">{t("didntReceive")}</strong>{" "}
                      {t("checkSpam")}
                    </AuthNote>
                  )}
                </VerifyEmailActions>

                <Button
                  onClick={() => router.push("/signin")}
                  variant="ghost"
                  className="h-11 w-full font-semibold"
                >
                  {t("backToLogin")}
                </Button>
              </div>
            </>
          )}

          {/* Verifying State */}
          {state === "verifying" && (
            <>
              <div className="mb-5">
                {/* Use a larger loader for the main verification state */}
                <InlineLoader size="md" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("verifyingTitle")}
              </h1>
              <p className="text-muted-foreground">
                {t("verifyingBody")}
              </p>
            </>
          )}

          {/* Success State */}
          {state === "success" && (
            <>
              <div className="mb-5">
                <CheckCircle className="size-8 text-success" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("successTitle")}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t("successBody")}
              </p>

              <AuthNote className="mb-6">{t("redirecting")}</AuthNote>

              <Button
                onClick={() => router.push(signInAfterVerification(email, callbackUrl))}
                className="h-11 w-full font-semibold"
              >
                {t("continue")}
              </Button>
            </>
          )}

          {/* Error State */}
          {state === "error" && (
            <>
              <div className="mb-5">
                <XCircle className="size-8 text-destructive" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("failedTitle")}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t("failedBody")}
              </p>

              {errorMessage && (
                <AuthNote tone="danger" className="mb-6">{errorMessage}</AuthNote>
              )}

              {/* Another code, not another account: the account exists, and
                  signing up again with the same address is refused. */}
              <div className="space-y-3">
                <VerifyEmailActions initialEmail={email} callbackUrl={callbackUrl} />

                <Button
                  onClick={() => router.push("/signin")}
                  variant="ghost"
                  className="h-11 w-full font-semibold"
                >
                  {t("backToLogin")}
                </Button>
              </div>
            </>
          )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
