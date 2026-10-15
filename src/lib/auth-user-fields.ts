import { aliasSchema, namePartSchema } from "@/lib/person-name";

/**
 * Better Auth's `user.additionalFields`, apart from `auth.ts` so they can be
 * tested without the database behind it.
 *
 * Better Auth accepts every additional field on `sign-up/email` and
 * `update-user` unless it says `input: false` (`parseInputData`,
 * better-auth 1.4.6). The four flags below did not, so anyone could sign up
 * already « vérifié », mark themselves not banned, or point their own account
 * at a Stripe account id. They are the server's to write. The name parts are
 * the only fields a client may set, each with the validator the forms use
 * (client_feedback_2026_10_spec.md §1, §11).
 */
export const USER_ADDITIONAL_FIELDS = {
  isVerified: {
    type: "boolean",
    required: false,
    defaultValue: false,
    input: false,
  },
  banned: {
    type: "boolean",
    required: false,
    defaultValue: false,
    input: false,
  },
  // Expose Stripe fields to the client
  stripeAccountId: {
    type: "string",
    required: false,
    input: false,
  },
  stripeAccountStatus: {
    type: "string",
    required: false,
    defaultValue: "pending",
    input: false,
  },
  firstName: {
    type: "string",
    required: false,
    validator: { input: namePartSchema },
  },
  lastName: {
    type: "string",
    required: false,
    validator: { input: namePartSchema },
  },
  alias: {
    type: "string",
    required: false,
    validator: { input: aliasSchema },
  },
} as const;
