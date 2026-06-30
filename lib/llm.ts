import Anthropic from "@anthropic-ai/sdk";
import { SessionMode } from "@/lib/orchestrator/types";

export interface LLMCall {
  systemPrompt: string;
  userMessage: string;
  mode: SessionMode | "GRADE";
}

const client = new Anthropic();

// Strip ```json ... ``` fences the model sometimes wraps around its JSON output
function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : raw.trim();
}

export async function callLLM({ systemPrompt, userMessage }: LLMCall): Promise<string> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = msg.content[0];
  if (!block) throw new Error("LLM returned empty content");
  if (block.type !== "text") throw new Error("Unexpected non-text block from LLM");
  return extractJSON(block.text);
}
