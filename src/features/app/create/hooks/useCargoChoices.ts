"use client";

import { useMemo, useRef } from "react";

import type { CargoChoice } from "../cargo";

/**
 * Which of the cargo answers the person gave themselves
 * (client feedback 2026-11-19, #21).
 *
 * A title suggestion — « Table » — comes with a guess at the weight and the
 * size, and the guess may fill a box nobody has answered. It may never replace
 * an answer: the client picked « 5 – 30 kg », clicked « Table », and the form
 * said « 30 – 100 kg » without a word (feedback 2026-11-19).
 *
 * Kept as its own fact rather than read off the values: a bracket equal to
 * what a suggestion would have written says nothing about who chose it. A ref,
 * not state — nothing on screen shows it, and it has to outlive the What step,
 * which unmounts on every step change.
 */
export interface CargoChoices {
  isByHand: (choice: CargoChoice) => boolean;
  /** `false` hands the answer back to the suggestions (a kind switch). */
  mark: (choice: CargoChoice, byHand?: boolean) => void;
}

export function useCargoChoices(
  initial: Partial<Record<CargoChoice, boolean>> = {}
): CargoChoices {
  const byHand = useRef<Record<CargoChoice, boolean>>({
    weight: false,
    size: false,
    ...initial,
  });

  return useMemo(
    () => ({
      isByHand: (choice) => byHand.current[choice],
      mark: (choice, value = true) => {
        byHand.current[choice] = value;
      },
    }),
    []
  );
}
