import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { transcribeLocaleSchema } from "@/server/dto/request-assistant.dto";
import { requestAssistantService } from "@/server/services/request-assistant.service";
import { ok, fail, unauthorised, handleError } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/listings/assist/transcribe — a short recording from the request
 * assistant's microphone button, as text (request_assistant_spec.md §3.3).
 *
 * The recording is passed to the transcription model and dropped: it is never
 * stored, and the text only goes back into the box the person can still edit.
 */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return unauthorised();

    const limit = rateLimit(`request-transcribe:${session.user.id}`, 6, 60 * 1000);
    if (!limit.allowed) {
      return fail(
        "RATE_LIMITED",
        `Too many attempts. Try again in ${limit.retryAfter} seconds.`,
        429
      );
    }

    const form = await req.formData();
    const audio = form.get("audio");
    // A form entry is a file or a string; anything but a file is no recording.
    if (!audio || typeof audio === "string") {
      return fail("AUDIO_REQUIRED", "No recording was sent.", 400);
    }
    const locale = transcribeLocaleSchema.parse(form.get("locale") ?? undefined);

    return ok({ text: await requestAssistantService.transcribe(audio, locale) });
  } catch (error) {
    return handleError(error, "Request assistant transcription");
  }
}
