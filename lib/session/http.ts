// ============================================================================
// Shared helpers for the session API routes: auth, ownership checks, input
// limits, and mapping failures to safe, user-facing error responses.
// ============================================================================

import { APIConnectionError, APIError } from "openai";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { dbToSnapshot } from "@/lib/orchestrator/db-mapping";
import type { ConceptSnapshot } from "@/lib/orchestrator/types";
import { LLMOutputError } from "@/lib/llm";

/** Longest learner answer or reply accepted, in characters. */
export const MAX_LEARNER_TEXT = 4000;
/** Longest session goal accepted, in characters. */
export const MAX_GOAL_LENGTH = 300;

/** An expected failure with a status and a message that is safe to show the user. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "Unauthorized");
  return user.id;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Invalid request body");
  }
  return body as Record<string, unknown>;
}

/**
 * Read a required piece of learner text. Rejects non-strings, blank text and
 * anything over `max` characters.
 */
export function requireText(value: unknown, field: string, max = MAX_LEARNER_TEXT): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `Missing '${field}'`);
  }
  if (value.length > max) {
    throw new HttpError(400, `'${field}' is too long (max ${max} characters)`);
  }
  return value;
}

/**
 * Load a session that belongs to `userId` and is still open.
 * 404 when it doesn't exist or belongs to someone else; 409 once it has ended.
 */
export async function loadOpenSession(userId: string, sessionId: unknown) {
  if (typeof sessionId !== "string" || sessionId === "") {
    throw new HttpError(400, "Missing session id");
  }
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new HttpError(404, "Session not found");
  if (session.endedAt) throw new HttpError(409, "This session has already ended");
  return session;
}

export async function loadConcepts(userId: string): Promise<ConceptSnapshot[]> {
  return (await prisma.conceptNode.findMany({ where: { userId } })).map(dbToSnapshot);
}

/**
 * Turn any failure into a JSON error response. Expected failures keep their
 * message; everything else is logged and replaced with a generic message so
 * database or provider internals never reach the browser.
 */
export function errorResponse(e: unknown, route: string): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }

  console.error(`[${route}]`, e);

  if (e instanceof LLMOutputError) {
    return Response.json(
      { error: "The tutor's reply came back garbled. Please try again." },
      { status: 502 }
    );
  }
  if (e instanceof APIConnectionError) {
    return Response.json(
      { error: "Couldn't reach the AI service. Check your connection and try again." },
      { status: 503 }
    );
  }
  if (e instanceof APIError) {
    if (e.status === 429) {
      return Response.json(
        { error: "The tutor is busy right now. Wait a moment and try again." },
        { status: 503 }
      );
    }
    return Response.json(
      { error: "The AI service had a problem. Please try again." },
      { status: 502 }
    );
  }
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
