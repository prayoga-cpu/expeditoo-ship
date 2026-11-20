import { api, ApiError } from "@/lib/fetcher";
import type { RequestDraft } from "@/server/dto/request-assistant.dto";

/**
 * How long the box waits for a reading. The server's own deadlines — the model
 * call and the map lookups (`request-assistant.service.ts`) — add up to less,
 * so this is the net under them: a connection that hangs, a function that
 * never answers.
 */
export const ASSISTANT_READ_TIMEOUT_MS = 30_000;
export const ASSISTANT_TIMEOUT = "ASSISTANT_TIMEOUT";

/**
 * `call`, or a refusal once it has had its time. The request is given up on
 * rather than cancelled — the shared fetcher takes no signal — and it changes
 * nothing on the server either way: a reading creates nothing.
 */
function inTime<T>(call: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ApiError(ASSISTANT_TIMEOUT, "The reading took too long", 408)),
      ms
    );
  });
  return Promise.race([call, late]).finally(() => clearTimeout(timer));
}

/**
 * The request assistant's three calls (docs/specs/request_assistant_spec.md
 * §3). None of them creates a request: `understand` answers values for the
 * form, and the form is still what posts.
 */
export const assistantApi = {
  availability: () =>
    api.get<{ available: boolean }>("/api/listings/assist"),

  understand: (text: string) =>
    inTime(
      api.post<RequestDraft>("/api/listings/assist", { text }),
      ASSISTANT_READ_TIMEOUT_MS
    ),

  transcribe: (audio: Blob, locale: string) => {
    const body = new FormData();
    // A name with an extension: the transcription model reads the container
    // from it, and a bare Blob has none.
    const extension = audio.type.includes("mp4") ? "mp4" : "webm";
    body.append("audio", audio, `request.${extension}`);
    body.append("locale", locale === "en" ? "en" : "fr");
    return api.post<{ text: string }>(
      "/api/listings/assist/transcribe",
      body
    );
  },
};
