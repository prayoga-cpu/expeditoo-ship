import { z } from "zod";
import {
  feedbackPriorityEnum,
  feedbackStatusEnum,
  feedbackTypeEnum,
} from "@/db/schema/feedback";
import type { FeedbackTicket } from "@/db/schema/feedback";
import { locales } from "@/i18n/config";

/**
 * Every enum is derived from its `pgEnum`, never restated — the same rule the
 * role enum is under (CLAUDE.md §Gotchas 8). The sibling product declares each
 * of these vocabularies three times over, and its client hook then omits one
 * of them entirely as a result.
 */
export const feedbackTypeSchema = z.enum(feedbackTypeEnum.enumValues);
export const feedbackStatusSchema = z.enum(feedbackStatusEnum.enumValues);
export const feedbackPrioritySchema = z.enum(feedbackPriorityEnum.enumValues);

export const MIN_FEEDBACK_DESCRIPTION = 10;
export const MAX_FEEDBACK_DESCRIPTION = 2000;
export const MAX_FEEDBACK_SCREENSHOTS = 4;
export const MAX_DEV_NOTE = 2000;
export const MAX_FEEDBACK_PATHNAME = 300;

/**
 * The pages a person can say they were on.
 *
 * A plain tuple rather than a `pgEnum`, so adding a screen never needs a
 * migration: which pages exist is UI knowledge, not database vocabulary. The
 * console groups by this; `pathname` is what actually reproduces the bug.
 */
export const FEEDBACK_SURFACES = [
  "home",
  "board",
  "create",
  "myRequests",
  "jobDetail",
  "deliveries",
  "messages",
  "trips",
  "earnings",
  "application",
  "profile",
  "driver",
  "admin",
  "other",
] as const;

export const feedbackSurfaceSchema = z.enum(FEEDBACK_SURFACES);
export type FeedbackSurface = (typeof FEEDBACK_SURFACES)[number];

/**
 * What a client may send, and nothing more.
 *
 * `userId`, `userName`, `userEmail`, `userRole`, `appVersion`, `status`,
 * `priority` and `devNote` are absent **by design**, exactly as `origin` is
 * absent from `createListingSchema`: accepting `priority` would let anyone jump
 * the triage queue, and accepting `userEmail` would let anyone file as someone
 * else. The service stamps all of them.
 */
export const submitFeedbackSchema = z.object({
  type: feedbackTypeSchema,
  surface: feedbackSurfaceSchema,
  pathname: z
    .string()
    .trim()
    .max(MAX_FEEDBACK_PATHNAME)
    .regex(/^\/\S*$/, "PATHNAME_INVALID")
    .optional(),
  description: z
    .string()
    .trim()
    .min(MIN_FEEDBACK_DESCRIPTION)
    .max(MAX_FEEDBACK_DESCRIPTION),
  screenshotUrls: z
    .array(z.string().url())
    .max(MAX_FEEDBACK_SCREENSHOTS)
    .default([]),
  locale: z.enum(locales),
});
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

/**
 * A staff patch. Deliberately does not require a note to resolve — incidents
 * does, but a queue of fifty "love the app" tickets has to be closable in fifty
 * taps.
 */
export const triageFeedbackSchema = z
  .object({
    status: feedbackStatusSchema.optional(),
    priority: feedbackPrioritySchema.optional(),
    devNote: z.string().trim().max(MAX_DEV_NOTE).nullable().optional(),
  })
  .refine(
    (v) =>
      v.status !== undefined ||
      v.priority !== undefined ||
      v.devNote !== undefined,
    { path: ["status"], message: "TRIAGE_PATCH_EMPTY" }
  );
export type TriageFeedbackInput = z.infer<typeof triageFeedbackSchema>;

/** The console's filter, applied in SQL rather than in the browser. */
export const feedbackQuerySchema = z.object({
  status: feedbackStatusSchema.optional(),
  type: feedbackTypeSchema.optional(),
  priority: feedbackPrioritySchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
export type FeedbackQuery = z.infer<typeof feedbackQuerySchema>;

/**
 * What the person who wrote it gets back.
 *
 * No `devNote` — that note is *about* them and is written for the team. The
 * sibling product returns its whole row here, so its private note goes over the
 * wire to the person it concerns and only the UI's choice not to render it
 * hides that. No `priority` either: an internal judgment about someone's
 * report is not theirs to read.
 */
export interface FeedbackView {
  id: string;
  type: (typeof feedbackTypeEnum.enumValues)[number];
  surface: string;
  description: string;
  screenshotUrls: string[];
  status: (typeof feedbackStatusEnum.enumValues)[number];
  createdAt: string;
}

export interface AdminFeedbackView extends FeedbackView {
  priority: (typeof feedbackPriorityEnum.enumValues)[number];
  devNote: string | null;
  pathname: string | null;
  appVersion: string;
  locale: string;
  userRole: string;
  reporter: {
    id: string | null;
    name: string;
    email: string;
    /** False once the account is deleted; the ticket survives it. */
    accountExists: boolean;
  };
  resolvedAt: string | null;
  updatedAt: string;
}

export function toFeedbackView(row: FeedbackTicket): FeedbackView {
  return {
    id: row.id,
    type: row.type,
    surface: row.surface,
    description: row.description,
    screenshotUrls: row.screenshotUrls ?? [],
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdminFeedbackView(
  row: FeedbackTicket,
  account: { id: string; name: string; email: string } | null
): AdminFeedbackView {
  return {
    ...toFeedbackView(row),
    priority: row.priority,
    devNote: row.devNote,
    pathname: row.pathname,
    appVersion: row.appVersion,
    locale: row.locale,
    userRole: row.userRole,
    reporter: {
      id: account?.id ?? row.userId,
      // Prefer the live account, fall back to the snapshot frozen at submit
      // time, so a ticket from a deleted account still reads as a person.
      name: account?.name ?? row.userName,
      email: account?.email ?? row.userEmail,
      accountExists: Boolean(account),
    },
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
