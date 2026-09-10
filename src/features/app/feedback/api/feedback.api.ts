import { api, toQuery } from "@/lib/fetcher";
import type {
  AdminFeedbackView,
  FeedbackQuery,
  FeedbackView,
  SubmitFeedbackInput,
  TriageFeedbackInput,
} from "@/server/dto/feedback.dto";

/**
 * Client API for feedback — see docs/specs/feedback_spec.md.
 *
 * The view and input TYPES are imported from the DTO rather than hand-written
 * here. `incidents.api.ts` restates its unions and that is the one place this
 * repo slips on CLAUDE.md §Gotchas 8; do not take it as licence. Types are
 * erased at build time, so importing them pulls no server code into the bundle.
 *
 * The upload wrapper is duplicated on purpose: features do not cross-import
 * (docs/rules.md §1.3). Two features calling the same REST route is the
 * intended shape; two features sharing a module is not.
 */

export interface FeedbackQueueResponse {
  items: AdminFeedbackView[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    counts: Record<string, number>;
  };
}

export const feedbackApi = {
  submit: (input: SubmitFeedbackInput) =>
    api.post<FeedbackView>("/api/feedback", input),

  listMine: () => api.get<FeedbackView[]>("/api/feedback"),

  queue: (params: Partial<FeedbackQuery>) =>
    api.get<FeedbackQueueResponse>(`/api/admin/feedback${toQuery(params)}`),

  triage: (id: string, input: TriageFeedbackInput) =>
    api.patch<AdminFeedbackView>(`/api/admin/feedback/${id}`, input),
};

export async function uploadFeedbackScreenshot(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body });
  const json = await res.json();

  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? "Upload failed");
  }
  return json.data.url as string;
}
