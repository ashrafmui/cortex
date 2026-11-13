import OpenAI from "openai";
import type { z } from "zod";
import { SessionMode } from "@/lib/orchestrator/types";

export interface LLMCall {
  systemPrompt: string;
  userMessage: string;
  mode: SessionMode | "GRADE";
}

// Lazily construct the client so importing this module has no side effects.
// (Building on CI evaluates route modules for page-data collection, where
// GROQ_API_KEY isn't present — an eager `new OpenAI(...)` would throw there.)
let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  }
  return client;
}

// Strip ```json ... ``` fences the model sometimes wraps around its JSON output
function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : raw.trim();
}

/** One completion. Returns the fence-stripped text, or "" if the model returned nothing. */
async function complete({ systemPrompt, userMessage }: LLMCall): Promise<string> {
  const msg = await getClient().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const content = msg.choices[0]?.message?.content;
  return content ? extractJSON(content) : "";
}

export async function callLLM(call: LLMCall): Promise<string> {
  const content = await complete(call);
  if (!content) throw new Error("LLM returned empty content");
  return content;
}

/** The model's output still wasn't valid JSON of the expected shape after a retry. */
export class LLMOutputError extends Error {
  constructor(
    message: string,
    readonly raw: string
  ) {
    super(message);
    this.name = "LLMOutputError";
  }
}

type Validated<T> = { ok: true; data: T } | { ok: false; problem: string };

function validate<S extends z.ZodType>(raw: string, schema: S): Validated<z.output<S>> {
  if (!raw) return { ok: false, problem: "the response was empty" };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, problem: "the response was not valid JSON" };
  }

  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };

  const problem = result.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, problem: `the JSON did not match the required structure (${problem})` };
}

const MAX_ATTEMPTS = 2; // the first try plus one corrective retry

/**
 * Call the LLM and validate its JSON against `schema`. On a parse or shape
 * failure, retry once with the problem spelled out in the system prompt.
 *
 * Returns the validated data plus `raw`, its normalized JSON string — store
 * `raw`, not the model's original text, so the session log only ever holds
 * validated shapes. Throws LLMOutputError if both attempts fail.
 */
export async function callLLMJson<S extends z.ZodType>(
  call: LLMCall,
  schema: S
): Promise<{ data: z.output<S>; raw: string }> {
  let problem = "";
  let lastRaw = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const systemPrompt =
      attempt === 1
        ? call.systemPrompt
        : `${call.systemPrompt}\n\nYOUR PREVIOUS RESPONSE WAS REJECTED: ${problem}. ` +
          `Respond again with ONLY the JSON object, using exactly the structure specified above.`;

    lastRaw = await complete({ ...call, systemPrompt });
    const result = validate(lastRaw, schema);
    if (result.ok) return { data: result.data, raw: JSON.stringify(result.data) };

    problem = result.problem;
    console.warn(`[llm] ${call.mode} attempt ${attempt}/${MAX_ATTEMPTS} rejected: ${problem}`);
  }

  throw new LLMOutputError(`LLM output invalid after ${MAX_ATTEMPTS} attempts: ${problem}`, lastRaw);
}
