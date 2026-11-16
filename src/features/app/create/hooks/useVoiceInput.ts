"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocale } from "next-intl";

import { assistantApi } from "../api/assistant.api";

/** A request is a sentence or two; the recording stops itself after this. */
export const MAX_RECORDING_MS = 60_000;

export type VoiceState = "idle" | "recording" | "transcribing";
export type VoiceProblem = "denied" | "failed";

const canRecord = () =>
  typeof window !== "undefined" &&
  typeof window.MediaRecorder !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;

/** Whether a browser can record does not change while the page is open. */
const noSubscription = () => () => {};

/**
 * The microphone button of the request assistant: record, stop, and hand the
 * text to `onText` (docs/specs/request_assistant_spec.md §3.3).
 *
 * The recording is held in memory, sent once and dropped; the text goes into
 * a box the person can still edit before anything is read from it.
 */
export function useVoiceInput(onText: (text: string) => void) {
  const locale = useLocale();
  const [state, setState] = useState<VoiceState>("idle");
  const [problem, setProblem] = useState<VoiceProblem | null>(null);
  // Read on the client only: the server render has no microphone to ask about.
  const supported = useSyncExternalStore(noSubscription, canRecord, () => false);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
  }, []);

  // Leaving the step must not leave the microphone open.
  useEffect(() => release, [release]);

  const finish = useCallback(
    async (chunks: Blob[], type: string) => {
      release();
      const audio = new Blob(chunks, { type });
      if (audio.size === 0) return setState("idle");
      setState("transcribing");
      try {
        const { text } = await assistantApi.transcribe(audio, locale);
        if (text) onText(text);
      } catch {
        setProblem("failed");
      } finally {
        setState("idle");
      }
    },
    [locale, onText, release]
  );

  const start = useCallback(async () => {
    setProblem(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setProblem("denied");
    }
    const next = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    next.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    next.onstop = () => void finish(chunks, next.mimeType || "audio/webm");
    recorder.current = next;
    next.start();
    setState("recording");
    timer.current = setTimeout(() => next.stop(), MAX_RECORDING_MS);
  }, [finish]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  return { supported, state, problem, start, stop };
}
