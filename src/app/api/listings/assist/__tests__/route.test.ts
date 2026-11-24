// @vitest-environment node
// A route receives a multipart body from Node's own fetch stack. Under jsdom the
// test's FormData/File are jsdom's while Request is Node's, and Node 24's parser
// (the Vercel build's) rejects that mix — 10 failures that Node 22/23 let pass.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "../route";
import { POST as TRANSCRIBE } from "../transcribe/route";
import { auth } from "@/lib/auth";
import { resetRateLimits } from "@/lib/rate-limit";
import {
  RequestAssistantError,
  requestAssistantService,
} from "@/server/services/request-assistant.service";

/**
 * The service has its own tests. What the routes add is the door: a session,
 * a brake, the body's shape, and a refusal that reaches the browser with its
 * code (request_assistant_spec.md §3, §7).
 */
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock("@/server/services/request-assistant.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/services/request-assistant.service")
  >()),
  requestAssistantService: {
    isAvailable: vi.fn(),
    understand: vi.fn(),
    transcribe: vi.fn(),
  },
}));

const sessionMock = vi.mocked(auth.api.getSession);
const service = vi.mocked(requestAssistantService);

const signedIn = (id = "user-1") =>
  sessionMock.mockResolvedValue({ user: { id } } as never);

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/listings/assist", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    })
  );

const recording = (file?: File, locale?: string) => {
  const body = new FormData();
  if (file) body.append("audio", file);
  if (locale) body.append("locale", locale);
  return TRANSCRIBE(
    new Request("http://localhost/api/listings/assist/transcribe", { method: "POST", body })
  );
};

const webm = () => new File([new Uint8Array(64)], "request.webm", { type: "audio/webm" });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  signedIn();
});

describe("GET /api/listings/assist", () => {
  it("is for signed-in people only", async () => {
    sessionMock.mockResolvedValue(null);

    expect((await GET()).status).toBe(401);
  });

  it("says whether the assistant can answer", async () => {
    service.isAvailable.mockReturnValue(false);

    expect((await (await GET()).json()).data).toEqual({ available: false });
  });
});

describe("POST /api/listings/assist", () => {
  it("is for signed-in people only, and reads nothing for anyone else", async () => {
    sessionMock.mockResolvedValue(null);

    expect((await post({ text: "un canapé" })).status).toBe(401);
    expect(service.understand).not.toHaveBeenCalled();
  });

  it("hands the text to the service and answers its reading", async () => {
    service.understand.mockResolvedValue({ title: "Canapé" } as never);

    const res = await post({ text: "  un canapé de Lyon à Bordeaux " });

    expect(res.status).toBe(200);
    expect(service.understand).toHaveBeenCalledWith("un canapé de Lyon à Bordeaux");
    expect((await res.json()).data).toEqual({ title: "Canapé" });
  });

  it.each([
    ["too short", "ab"],
    ["too long", "a".repeat(1501)],
    ["absent", undefined],
  ])("refuses a text that is %s", async (_, text) => {
    const res = await post({ text });

    expect(res.status).toBe(400);
    expect(service.understand).not.toHaveBeenCalled();
  });

  it("passes the service's refusal on with its code", async () => {
    service.understand.mockRejectedValue(
      new RequestAssistantError("ASSISTANT_UNAVAILABLE", 503)
    );

    const res = await post({ text: "un canapé" });

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ASSISTANT_UNAVAILABLE");
  });

  it("stops the eleventh reading in a minute, per person", async () => {
    service.understand.mockResolvedValue({} as never);
    for (let i = 0; i < 10; i++) expect((await post({ text: "un canapé" })).status).toBe(200);

    const refused = await post({ text: "un canapé" });
    expect(refused.status).toBe(429);
    expect((await refused.json()).error.code).toBe("RATE_LIMITED");

    signedIn("user-2");
    expect((await post({ text: "un canapé" })).status).toBe(200);
  });
});

describe("POST /api/listings/assist/transcribe", () => {
  it("is for signed-in people only", async () => {
    sessionMock.mockResolvedValue(null);

    expect((await recording(webm())).status).toBe(401);
    expect(service.transcribe).not.toHaveBeenCalled();
  });

  it("answers the text of the recording, in the language asked for", async () => {
    service.transcribe.mockResolvedValue("un canapé");

    const res = await recording(webm(), "en");

    expect((await res.json()).data).toEqual({ text: "un canapé" });
    expect(service.transcribe.mock.calls[0][1]).toBe("en");
  });

  it("reads French when no language is given", async () => {
    service.transcribe.mockResolvedValue("ok");

    await recording(webm());

    expect(service.transcribe.mock.calls[0][1]).toBe("fr");
  });

  it("refuses a request with no recording in it", async () => {
    const res = await recording();

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("AUDIO_REQUIRED");
  });
});
