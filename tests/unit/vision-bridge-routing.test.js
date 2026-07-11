import { describe, expect, it, vi } from "vitest";
import { findBridgeAttachments } from "../../src/lib/visionBridge/attachments.js";
import { handleVisionBridgeChat } from "../../src/lib/visionBridge/bridge.js";

function response(ok, json = {}, status = 200) {
  const make = () => ({ ok, status, clone: make, json: async () => json });
  return make();
}

const profile = {
  id: "bridge-1",
  config: {
    primaryModel: "text/glm-5.2",
    maxAttachmentsPerRequest: 8,
    attachmentCacheTtlHours: 72,
    attachmentCacheMaxEntries: 2000,
    visionModels: [
      { model: "vision/first", timeoutMs: 1000, maxOutputTokens: 1000, enabled: true },
      { model: "vision/second", timeoutMs: 1000, maxOutputTokens: 1000, enabled: true },
    ],
  },
};

describe("Vision Bridge routing", () => {
  it("falls through visual models then sends only text to the primary model", async () => {
    const calls = [];
    const handleSingleModel = vi.fn(async (body, model) => {
      calls.push({ body, model });
      if (model === "vision/first(low)") return response(false, { error: { message: "busy" } }, 503);
      if (model === "vision/second(low)") return response(true, { choices: [{ message: { content: "OCR: hello" } }] });
      return response(true, { choices: [{ message: { content: "final" } }] });
    });
    const body = {
      messages: [{ role: "user", content: [{ type: "text", text: "What is this?" }, { type: "image_url", image_url: "https://example.test/image.png" }] }],
      system: "large client system prompt that must not reach visual extraction",
      thinking: { type: "adaptive" },
      output_config: { effort: "xhigh" },
      stream: true,
      tools: [{ type: "function", function: { name: "danger" } }],
    };

    const result = await handleVisionBridgeChat({ body, profile, handleSingleModel, log: { info: () => {}, warn: () => {} } });
    expect(result.ok).toBe(true);
    expect(calls.map((call) => call.model)).toEqual(["vision/first(low)", "vision/second(low)", "text/glm-5.2"]);
    expect(calls[1].body.stream).toBe(false);
    expect(calls[1].body.tools).toBeUndefined();
    expect(calls[1].body.system).toBeUndefined();
    expect(calls[1].body.thinking).toBeUndefined();
    expect(calls[1].body.output_config).toBeUndefined();
    expect(calls[1].body.reasoning_effort).toBe("low");
    expect(findBridgeAttachments(calls[2].body)).toEqual([]);
    expect(calls[2].body.messages[0].content[1].text).toContain("OCR: hello");
  });

  it("uses low adaptive thinking and removes the Claude system prompt for visual extraction", async () => {
    const calls = [];
    const handleSingleModel = vi.fn(async (body, model) => {
      calls.push({ body, model });
      return model.startsWith("vision/")
        ? response(true, { content: [{ type: "text", text: "OCR: screenshot" }] })
        : response(true, { content: [{ type: "text", text: "final" }] });
    });
    const body = {
      system: [{ type: "text", text: "Cowork system instructions" }],
      messages: [{ role: "user", content: [{ type: "text", text: "Describe it" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "dW5pcXVlLXZpc2lvbi1sb3ctdGVzdA==" } }] }],
      thinking: { type: "adaptive" },
      output_config: { effort: "xhigh" },
      stream: true,
    };

    const result = await handleVisionBridgeChat({ body, profile, handleSingleModel, log: {} });
    expect(result.ok).toBe(true);
    expect(calls[0].body.system).toBeUndefined();
    expect(calls[0].body.thinking).toEqual({ type: "adaptive" });
    expect(calls[0].body.output_config).toEqual({ effort: "low" });
    expect(calls[0].body.stream).toBe(false);
  });

  it("uses the primary model directly for text-only requests", async () => {
    const handleSingleModel = vi.fn(async () => response(true));
    await handleVisionBridgeChat({
      body: { messages: [{ role: "user", content: "hello" }] },
      profile,
      handleSingleModel,
      log: {},
    });
    expect(handleSingleModel).toHaveBeenCalledTimes(1);
    expect(handleSingleModel.mock.calls[0][1]).toBe("text/glm-5.2");
  });

  it("uses text fallbacks only after transcription succeeds", async () => {
    const fallbackProfile = { ...profile, config: { ...profile.config, textFallbackModels: ["text/backup"] } };
    const handleSingleModel = vi.fn(async (_body, model) => model === "text/glm-5.2" ? response(false, {}, 503) : response(true));
    const result = await handleVisionBridgeChat({ body: { messages: [{ role: "user", content: "hello" }] }, profile: fallbackProfile, handleSingleModel, log: { warn: () => {} } });
    expect(result.ok).toBe(true);
    expect(handleSingleModel.mock.calls.map((call) => call[1])).toEqual(["text/glm-5.2", "text/backup"]);
  });

  it("compacts old attachments until the user explicitly refers to an image", async () => {
    const calls = [];
    const onDemandProfile = { ...profile, config: { ...profile.config, historyAttachmentMode: "onDemand", historyAttachmentCompactChars: 200, historyAttachmentRestoreMaxAttachments: 2 } };
    const handleSingleModel = vi.fn(async (body, model) => {
      calls.push({ body, model });
      if (model.startsWith("vision/")) return response(true, { choices: [{ message: { content: "OCR: old image" } }] });
      return response(true, { choices: [{ message: { content: "final" } }] });
    });
    const body = {
      messages: [
        { role: "user", content: [{ type: "image_url", image_url: "https://example.test/old-image.png" }] },
        { role: "user", content: "Tell me a joke about databases." },
      ],
    };

    await handleVisionBridgeChat({ body, profile: onDemandProfile, handleSingleModel, log: {} });
    expect(calls.map((call) => call.model)).toEqual(["text/glm-5.2"]);
    expect(calls[0].body.messages[0].content[0].text).toContain("历史图片附件已归档");

    calls.length = 0;
    await handleVisionBridgeChat({ body: { ...body, messages: [...body.messages.slice(0, 1), { role: "user", content: "What is in the image above?" }] }, profile: onDemandProfile, handleSingleModel, log: {} });
    expect(calls.map((call) => call.model)).toEqual(["vision/first(low)", "text/glm-5.2"]);
  });

  it("does not reject a long history merely because it contains archived attachments", async () => {
    const onDemandProfile = { ...profile, config: { ...profile.config, maxAttachmentsPerRequest: 1, historyAttachmentMode: "onDemand", historyAttachmentCompactChars: 200, historyAttachmentRestoreMaxAttachments: 2 } };
    const handleSingleModel = vi.fn(async () => response(true, { choices: [{ message: { content: "final" } }] }));
    const body = {
      messages: [
        ...Array.from({ length: 4 }, (_, index) => ({ role: "user", content: [{ type: "image_url", image_url: `https://example.test/old-${index}.png` }] })),
        { role: "user", content: "Please summarize our discussion." },
      ],
    };

    const result = await handleVisionBridgeChat({ body, profile: onDemandProfile, handleSingleModel, log: {} });
    expect(result.ok).toBe(true);
    expect(handleSingleModel).toHaveBeenCalledTimes(1);
    expect(handleSingleModel.mock.calls[0][0].messages[0].content[0].text).toContain("历史图片附件已归档");
  });

  it("automatically compresses old text turns before the primary model sees them", async () => {
    const compressionProfile = {
      ...profile,
      config: {
        ...profile.config,
        primaryContextTokens: 4000,
        primaryContextBudgetTokens: 3000,
        autoCompressionEnabled: true,
        autoCompressionThresholdTokens: 1000,
        autoCompressionTargetTokens: 256,
        autoCompressionKeepRecentTurns: 2,
      },
    };
    const calls = [];
    const handleSingleModel = vi.fn(async (body, model) => {
      calls.push({ body, model });
      const isCompression = body.messages?.[0]?.content?.includes("Compress the supplied earlier conversation");
      return isCompression
        ? response(true, { choices: [{ message: { content: "Earlier user goals and decisions." } }] })
        : response(true, { choices: [{ message: { content: "final" } }] });
    });
    const body = {
      messages: Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `turn-${index} ${"detail ".repeat(100)}` })),
    };

    const result = await handleVisionBridgeChat({ body, profile: compressionProfile, handleSingleModel, log: {} });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1].body.messages.some((message) => String(message.content).includes("历史对话摘要"))).toBe(true);
    expect(calls[1].body.messages.at(-1).content).toContain("turn-9");
  });
});
