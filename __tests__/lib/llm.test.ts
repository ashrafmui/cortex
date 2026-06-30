import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionMode } from "@/lib/orchestrator/types";

// Must be hoisted so the class body can reference it before imports resolve
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  // Use a class so `new Anthropic()` doesn't throw — arrow functions aren't constructors
  default: class {
    messages = { create: mockCreate };
  },
}));

const { callLLM } = await import("@/lib/llm");

function makeTextContent(text: string) {
  return {
    content: [{ type: "text", text }],
    id: "msg_1",
    model: "claude-sonnet-4-6",
    role: "assistant",
    type: "message",
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

describe("callLLM", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("calls messages.create with the correct model and parameters", async () => {
    mockCreate.mockResolvedValue(makeTextContent('{"key":"value"}'));
    await callLLM({ systemPrompt: "sys", userMessage: "user", mode: SessionMode.TEACH });
    expect(mockCreate).toHaveBeenCalledWith({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: "sys",
      messages: [{ role: "user", content: "user" }],
    });
  });

  it("returns raw text when the model returns plain JSON", async () => {
    const json = '{"explanation":"hello","check_question":"why?","concepts_introduced":[]}';
    mockCreate.mockResolvedValue(makeTextContent(json));
    const result = await callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.TEACH });
    expect(result).toBe(json);
  });

  it("strips ```json ... ``` fences", async () => {
    const inner = '{"key":"value"}';
    mockCreate.mockResolvedValue(makeTextContent("```json\n" + inner + "\n```"));
    const result = await callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.QUIZ });
    expect(result).toBe(inner);
  });

  it("strips plain ``` ... ``` fences (no language tag)", async () => {
    const inner = '{"key":"value"}';
    mockCreate.mockResolvedValue(makeTextContent("```\n" + inner + "\n```"));
    const result = await callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.REVIEW });
    expect(result).toBe(inner);
  });

  it("trims surrounding whitespace from unfenced responses", async () => {
    mockCreate.mockResolvedValue(makeTextContent('  {"key":"value"}  '));
    const result = await callLLM({ systemPrompt: "s", userMessage: "u", mode: "GRADE" });
    expect(result).toBe('{"key":"value"}');
  });

  it("throws when content array is empty", async () => {
    mockCreate.mockResolvedValue({ content: [] });
    await expect(
      callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.TEACH })
    ).rejects.toThrow("LLM returned empty content");
  });

  it("throws when the content block is not a text block", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "tu_1", name: "fn", input: {} }],
    });
    await expect(
      callLLM({ systemPrompt: "s", userMessage: "u", mode: SessionMode.TEACH })
    ).rejects.toThrow("Unexpected non-text block from LLM");
  });
});
