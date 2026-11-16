import { api } from "@/lib/fetcher";
import type { RequestDraft } from "@/server/dto/request-assistant.dto";

/**
 * The request assistant's three calls (docs/specs/request_assistant_spec.md
 * §3). None of them creates a request: `understand` answers values for the
 * form, and the form is still what posts.
 */
export const assistantApi = {
  availability: () =>
    api.get<{ available: boolean }>("/api/listings/assist"),

  understand: (text: string) =>
    api.post<RequestDraft>("/api/listings/assist", { text }),

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
