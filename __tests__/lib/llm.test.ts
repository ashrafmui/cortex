import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionMode } from "@/lib/orchestrator/types";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

const { callLLM } = await import("@/lib/llm");

function makeCompletion(content: string) {
  return {
    choices: [{ message: { role: "assistant", content } }],
    id: "chatcmpl-1",
    model: "llama-3.3-70b-versatile",
    object: "chat.completion",
  };
}

describe("callLLM", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("calls chat.completions.create with system + user messages", async () => {
    mockCreate.mockResolvedValue(makeCompletion('{"key":"value"}'));
    await callLLM({ systemPrompt: "sys", userMessage: "user", mode: SessionMode.TEACH });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "system", content: "sys" },
          { role: "user", content: "user" },
        ],
      })
    );
  });

  it("returns raw text when the model returns plain JSON", async () => {
    const json = '{"explanation":"hello","check_question":"why?","concepts_introduced":[]}';
    mockCreate.mockResolvedValue(makeCompletion(json));
    const result = await callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.TEACH });
    expect(result).toBe(json);
  });

  it("strips ```json ... ``` fences", async () => {
    const inner = '{"key":"value"}';
    mockCreate.mockResolvedValue(makeCompletion("```json\n" + inner + "\n```"));
    const result = await callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.QUIZ });
    expect(result).toBe(inner);
  });

  it("strips plain ``` ... ``` fences (no language tag)", async () => {
    const inner = '{"key":"value"}';
    mockCreate.mockResolvedValue(makeCompletion("```\n" + inner + "\n```"));
    const result = await callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.REVIEW });
    expect(result).toBe(inner);
  });

  it("trims surrounding whitespace from unfenced responses", async () => {
    mockCreate.mockResolvedValue(makeCompletion('  {"key":"value"}  '));
    const result = await callLLM({ systemPrompt: "s", userMessage: "u", mode: "GRADE" });
    expect(result).toBe('{"key":"value"}');
  });

  it("throws when choices array is empty", async () => {
    mockCreate.mockResolvedValue({ choices: [] });
    await expect(
      callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.TEACH })
    ).rejects.toThrow("LLM returned empty content");
  });

  it("throws when message content is null", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: null } }] });
    await expect(
      callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.TEACH })
    ).rejects.toThrow("LLM returned empty content");
  });
});
