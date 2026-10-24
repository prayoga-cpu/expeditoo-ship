import { parseListingReference } from "@/lib/listing-reference";

/**
 * Whether a conversation answers what was typed in the Messages search box
 * (client feedback 2026-10-21, §D5: « la recherche de messages devrait
 * proposer les annonces en cours avec départ et arrivée »).
 *
 * It used to match the other person's name and the listing title only, so
 * « Clamart » or « Paris → Clamart » found nothing on a thread about a job
 * between those two towns. It now also reads:
 *
 * - either city of the job;
 * - a route typed with an arrow or a dash (« Paris → Clamart », « paris -
 *   clamart », « Paris->Clamart »), which must match both ends, in order;
 * - the job's reference, with or without its « Réf. » or route letters.
 *
 * Accents and case are ignored throughout: « clamart » finds « Clamart »,
 * « evry » finds « Évry ».
 */

export interface SearchableConversation {
  participantNames: (string | null | undefined)[];
  listing?: {
    title?: string | null;
    reference?: number | null;
    pickupCity?: string | null;
    dropoffCity?: string | null;
  } | null;
}

export function fold(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

const ROUTE_SEPARATOR = /\s*(?:→|->|—|–|\s-\s|>)\s*/u;

export function matchesConversationSearch(
  conversation: SearchableConversation,
  query: string
): boolean {
  const q = fold(query);
  if (!q) return true;
  const { listing } = conversation;

  const reference = parseListingReference(query);
  if (reference !== null && listing?.reference === reference) return true;

  const from = fold(listing?.pickupCity);
  const to = fold(listing?.dropoffCity);
  const ends = q.split(ROUTE_SEPARATOR).filter(Boolean);
  // A title can hold a dash too (« BETA - Bureau plat »), so a route that
  // does not match falls through to the plain search below.
  if (ends.length === 2 && from.includes(ends[0]) && to.includes(ends[1])) {
    return true;
  }

  return [
    ...conversation.participantNames,
    listing?.title,
    listing?.pickupCity,
    listing?.dropoffCity,
  ].some((field) => fold(field).includes(q));
}
