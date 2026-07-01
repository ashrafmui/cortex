import OpenAI from "openai";
import { SessionMode } from "@/lib/orchestrator/types";

export interface LLMCall {
  systemPrompt: string;
  userMessage: string;
  mode: SessionMode | "GRADE";
}

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Strip ```json ... ``` fences the model sometimes wraps around its JSON output
function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : raw.trim();
}

export async function callLLM({ systemPrompt, userMessage }: LLMCall): Promise<string> {
  const msg = await client.chat.completions.create({
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
