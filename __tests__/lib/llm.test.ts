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
    vi.stubEnv("GROQ_API_KEY", "test-key"); // lazy client needs a key to construct
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

// ── callLLMJson: validation + one corrective retry ───────────────────────────

const { callLLMJson, LLMOutputError } = await import("@/lib/llm");
const { TeachResponseSchema, QuizGradeResponseSchema } = await import("@/lib/orchestrator/schemas");

const validTeach = { explanation: "A pointer stores an address.", check_question: "What is deref?" };
const call = { systemPrompt: "SYS", userMessage: "u", mode: SessionMode.TEACH } as const;

describe("callLLMJson", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns validated data with defaults filled, and raw as its normalized JSON", async () => {
    mockCreate.mockResolvedValue(makeCompletion(JSON.stringify(validTeach)));
    const { data, raw } = await callLLMJson(call, TeachResponseSchema);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(data).toEqual({ ...validTeach, hints: [], concepts_introduced: [] });
    expect(JSON.parse(raw)).toEqual(data);
  });

  it("retries once on malformed JSON, telling the model what was wrong", async () => {
    mockCreate
      .mockResolvedValueOnce(makeCompletion("Sure! Here is the explanation: ..."))
      .mockResolvedValueOnce(makeCompletion(JSON.stringify(validTeach)));
    const { data } = await callLLMJson(call, TeachResponseSchema);
    expect(data.explanation).toBe(validTeach.explanation);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    const retrySystem = mockCreate.mock.calls[1][0].messages[0].content as string;
    expect(retrySystem.startsWith("SYS")).toBe(true);
    expect(retrySystem).toContain("YOUR PREVIOUS RESPONSE WAS REJECTED");
    expect(retrySystem).toContain("not valid JSON");
  });

  it("retries once when the JSON is missing required fields", async () => {
    mockCreate
      .mockResolvedValueOnce(makeCompletion('{"explanation":"only half"}'))
      .mockResolvedValueOnce(makeCompletion(JSON.stringify(validTeach)));
    await callLLMJson(call, TeachResponseSchema);
    const retrySystem = mockCreate.mock.calls[1][0].messages[0].content as string;
    expect(retrySystem).toContain("check_question");
  });

  it("retries once on an empty response", async () => {
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: null } }] })
      .mockResolvedValueOnce(makeCompletion(JSON.stringify(validTeach)));
    const { data } = await callLLMJson(call, TeachResponseSchema);
    expect(data.check_question).toBe(validTeach.check_question);
  });

  it("throws LLMOutputError (with the last raw output) when the retry also fails", async () => {
    mockCreate.mockResolvedValue(makeCompletion("not json"));
    const err = await callLLMJson(call, TeachResponseSchema).catch((e) => e);
    expect(err).toBeInstanceOf(LLMOutputError);
    expect(err.raw).toBe("not json");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("rejects grades outside 0–1 instead of clamping them", async () => {
    mockCreate
      .mockResolvedValueOnce(makeCompletion('{"score":8,"reasoning":"good","correct_answer":"x"}'))
      .mockResolvedValueOnce(makeCompletion('{"score":"0.8","reasoning":"good","correct_answer":"x"}'));
    const { data } = await callLLMJson({ ...call, mode: "GRADE" }, QuizGradeResponseSchema);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(data.score).toBe(0.8); // numeric strings are coerced
  });
});
