import OpenAI from "openai";
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

export async function callLLM({ systemPrompt, userMessage }: LLMCall): Promise<string> {
  const msg = await getClient().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const content = msg.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty content");
  return extractJSON(content);
}
