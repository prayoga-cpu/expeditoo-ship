"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { RequestDraft } from "@/server/dto/request-assistant.dto";
import { assistantApi } from "../api/assistant.api";
import { joinSaid } from "../assistant";

/**
 * The request assistant's conversation, such as it is: what the person has
 * said so far and the latest reading of it
 * (docs/specs/request_assistant_spec.md §3-4).
 *
 * There is no conversation on the server. A follow-up answer is added to
 * `said` and the whole of it is read again, so the reading is always of the
 * complete request and a correction (« non, plutôt Toulouse ») simply wins.
 */
export function useRequestAssistant() {
  const [said, setSaid] = useState<string[]>([]);
  const [draft, setDraft] = useState<RequestDraft | null>(null);

  // Hidden unless it can answer: no key on the server means no box, not a
  // box that fails. A failed check hides it too — the form below is whole.
  const availability = useQuery({
    queryKey: ["create", "assistant", "availability"],
    queryFn: assistantApi.availability,
    staleTime: Infinity,
    retry: false,
  });

  const reading = useMutation({
    mutationFn: (next: string[]) => assistantApi.understand(joinSaid(next)),
    onSuccess: (result, next) => {
      setSaid(next);
      setDraft(result);
    },
  });

  const { mutate, reset: resetReading } = reading;

  /** Read what was said so far plus `text`. */
  const say = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      mutate([...said, text]);
    },
    [mutate, said]
  );

  const reset = useCallback(() => {
    setSaid([]);
    setDraft(null);
    resetReading();
  }, [resetReading]);

  return {
    available: availability.data?.available === true,
    draft,
    say,
    reset,
    isReading: reading.isPending,
    error: reading.error,
  };
}
