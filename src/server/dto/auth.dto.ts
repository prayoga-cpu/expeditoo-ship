import { z } from "zod";

// ========================================
// Sign Up
// ========================================

export const signUpInputSchema = z
  .object({
    email: z.string().email("Invalid email format").toLowerCase().trim(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1, "Name is required").trim(),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpInputSchema>;

export const signUpOutputSchema = z.object({
  success: z.boolean(),
  userId: z.string().uuid(),
  message: z.string().optional(),
});

export type SignUpOutput = z.infer<typeof signUpOutputSchema>;

// ========================================
// Sign In
// ========================================

export const signInInputSchema = z.object({
  email: z.string().email("Invalid email format").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export type SignInInput = z.infer<typeof signInInputSchema>;

export const signInOutputSchema = z.object({
  success: z.boolean(),
  user: z
    .object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string(),
      image: z.string().nullable(),
      emailVerified: z.date().nullable(),
    })
    .optional(),
  session: z
    .object({
      id: z.string(),
      expiresAt: z.date(),
    })
    .optional(),
  message: z.string().optional(),
});

export type SignInOutput = z.infer<typeof signInOutputSchema>;

// ========================================
// Verify Email
// ========================================

export const verifyEmailInputSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;

export const verifyEmailOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type VerifyEmailOutput = z.infer<typeof verifyEmailOutputSchema>;

// ========================================
// Resend Verification Email
// ========================================

export const resendVerificationInputSchema = z.object({
  email: z.string().email("Invalid email format").toLowerCase().trim(),
});

export type ResendVerificationInput = z.infer<
  typeof resendVerificationInputSchema
>;

export const resendVerificationOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type ResendVerificationOutput = z.infer<
  typeof resendVerificationOutputSchema
>;

// ========================================
// Request Password Reset
// ========================================

export const requestPasswordResetInputSchema = z.object({
  email: z.string().email("Invalid email format").toLowerCase().trim(),
});

export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetInputSchema
>;

export const requestPasswordResetOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type RequestPasswordResetOutput = z.infer<
  typeof requestPasswordResetOutputSchema
>;

// ========================================
// Reset Password
// ========================================

export const resetPasswordInputSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

export const resetPasswordOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type ResetPasswordOutput = z.infer<typeof resetPasswordOutputSchema>;

// ========================================
// Change Password (Authenticated User)
// ========================================

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export const changePasswordOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type ChangePasswordOutput = z.infer<typeof changePasswordOutputSchema>;

// ========================================
// Sign Out
// ========================================

export const signOutOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type SignOutOutput = z.infer<typeof signOutOutputSchema>;

// ========================================
// Get Session
// ========================================

export const sessionOutputSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    image: z.string().nullable(),
    emailVerified: z.date().nullable(),
    roles: z.array(z.string()),
  }),
  session: z.object({
    id: z.string(),
    expiresAt: z.date(),
  }),
});

export type SessionOutput = z.infer<typeof sessionOutputSchema>;
