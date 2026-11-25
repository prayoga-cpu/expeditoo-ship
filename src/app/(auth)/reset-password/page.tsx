"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthActions } from "@/features/auth/hooks/useAuthActions";
import { AuthErrorNotice, AuthNote, AuthShell } from "@/features/auth/ui";
import { useTranslations } from "next-intl";

// French first, like every other page a client reaches (client feedback
// 2026-10-21, §C4): this page was the one English screen on the way back into
// an account.
function resetPasswordSchema(t: (key: string) => string) {
  return z
    .object({
      password: z.string().min(8, t("passwordMin")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("mismatch"),
      path: ["confirmPassword"],
    });
}

type ResetPasswordFormData = z.infer<ReturnType<typeof resetPasswordSchema>>;

type ResetState = "idle" | "success" | "error" | "no-token";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth.resetPassword");
  const { resetPassword, isLoading, error: authError } = useAuthActions();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetState, setResetState] = useState<ResetState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setResetState("no-token");
    }
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema(t)),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setServerError(t("missingToken"));
      setResetState("error");
      return;
    }

    setServerError(null);
    const result = await resetPassword(token, data.password);

    if (result.success) {
      setResetState("success");
      // Redirect to signin after 3 seconds
      setTimeout(() => {
        router.push("/signin");
      }, 3000);
    } else if (result.error === "invalidToken") {
      // Only a dead link ends the form: the screen it leads to already says
      // so and offers a new one. Anything else — a lost connection, too many
      // attempts — leaves the form up with the notice, to be tried again;
      // it used to cost the person their link.
      setResetState("error");
    }
  };

  return (
    <AuthShell
      below={
        <p className="mt-8 text-sm text-muted-foreground">
          {t("needHelp")}{" "}
          <a
            href="mailto:support@expeditop.fr"
            className="text-primary hover:text-primary/80 font-medium"
          >
            {t("contactSupport")}
          </a>
        </p>
      }
    >
          {/* No Token State */}
          {resetState === "no-token" && (
            <>
              <div className="mb-5">
                <XCircle className="size-8 text-destructive" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("invalidTitle")}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t("invalidBody")}
              </p>

              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/forgot-password")}
                  className="h-11 w-full font-semibold"
                >
                  {t("requestNew")}
                </Button>

                <Button
                  onClick={() => router.push("/signin")}
                  variant="outline"
                  className="h-11 w-full font-semibold"
                >
                  {t("backToSignIn")}
                </Button>
              </div>
            </>
          )}

          {/* Success State */}
          {resetState === "success" && (
            <>
              <div className="mb-5">
                <CheckCircle className="size-8 text-success" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("success")}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t("successBody")}
              </p>

              <AuthNote className="mb-6">{t("redirecting")}</AuthNote>

              <Button
                onClick={() => router.push("/signin")}
                className="h-11 w-full font-semibold"
              >
                {t("signInNow")}
              </Button>
            </>
          )}

          {/* Error State */}
          {resetState === "error" && (
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

              {serverError && (
                <AuthNote tone="danger" className="mb-6">{serverError}</AuthNote>
              )}

              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/forgot-password")}
                  className="h-11 w-full font-semibold"
                >
                  {t("requestNew")}
                </Button>

                <Button
                  onClick={() => router.push("/signin")}
                  variant="outline"
                  className="h-11 w-full font-semibold"
                >
                  {t("backToSignIn")}
                </Button>
              </div>
            </>
          )}

          {/* Idle State - Reset Form */}
          {resetState === "idle" && (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("title")}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t("subtitle")}
              </p>

              {/* Error Display */}
              <AuthErrorNotice error={authError} />

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("password")}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      {...register("password")}
                      disabled={isLoading}
                      className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.password.message}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs mt-1">
                    {t("passwordHint")}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("confirmPassword")}
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      {...register("confirmPassword")}
                      disabled={isLoading}
                      className={`pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-11 w-full font-semibold"
                >
                  {isLoading ? t("submitting") : t("submit")}
                </Button>
              </form>

              <Button
                onClick={() => router.push("/signin")}
                variant="outline"
                className="mt-3 h-11 w-full font-semibold"
              >
                {t("backToSignIn")}
              </Button>
            </>
          )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
