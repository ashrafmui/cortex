// ============================================================================
// Server-authoritative session state
// ============================================================================
// The client keeps a copy of SessionState between requests and sends it back,
// but nothing it sends is trusted for anything that matters. Each session route
// rebuilds the state from the stored Session row and the user's own concepts.
//
// Pure and framework-free so it can be unit-tested.
// ============================================================================

import type { ConceptSnapshot, SessionState } from "@/lib/orchestrator/types";
import { createPlaceholderConcept } from "@/lib/orchestrator/mode-selector";
import {
  rebuildBlocks,
  rehydrateSession,
  type SessionBlock,
  type StoredSession,
} from "./rehydrate";

const PLACEHOLDER_ID = "placeholder";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Rebuild the SessionState for a request.
 *
 * From the database (authoritative): identity, goal, mode, the exchange log,
 * conceptsHit, Socratic turns, and the full concept snapshot (mastery, SM-2
 * fields).
 *
 * From the client (validated): which concept is current, honored only if it is
 * one of this user's concepts (or the goal placeholder), and the per-mode
 * exchange counter, honored only if it is in range. Neither can touch
 * another user's data or forge mastery.
 */
export function reconcileSessionState(
  stored: StoredSession,
  concepts: ConceptSnapshot[],
  claimed: unknown
): SessionState {
  const { sessionState: base } = rehydrateSession(stored, concepts);
  const client = isRecord(claimed) ? claimed : {};

  const claimedConcept = isRecord(client.currentConcept) ? client.currentConcept : null;
  let currentConcept: ConceptSnapshot | null = null;
  if (claimedConcept?.id === PLACEHOLDER_ID) {
    currentConcept = createPlaceholderConcept(stored.goal);
  } else if (typeof claimedConcept?.id === "string") {
    currentConcept = concepts.find((c) => c.id === claimedConcept.id) ?? null;
  }

  const n = client.exchangeCount;
  const exchangeCount =
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= base.totalExchanges
      ? n
      : base.exchangeCount;

  return { ...base, currentConcept, exchangeCount };
}

/** The block currently waiting on the learner according to the stored log, or null. */
export function findPendingBlock(messages: unknown): SessionBlock | null {
  const log = (Array.isArray(messages) ? messages : []) as Parameters<typeof rebuildBlocks>[0];
  const blocks = rebuildBlocks(log);
  const last = blocks[blocks.length - 1];
  return last && last.status === "active" ? last : null;
}
