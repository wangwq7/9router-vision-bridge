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
      if (model === "vision/first") return response(false, { error: { message: "busy" } }, 503);
      if (model === "vision/second") return response(true, { choices: [{ message: { content: "OCR: hello" } }] });
      return response(true, { choices: [{ message: { content: "final" } }] });
    });
    const body = {
      messages: [{ role: "user", content: [{ type: "text", text: "What is this?" }, { type: "image_url", image_url: "https://example.test/image.png" }] }],
      stream: true,
      tools: [{ type: "function", function: { name: "danger" } }],
    };

    const result = await handleVisionBridgeChat({ body, profile, handleSingleModel, log: { info: () => {}, warn: () => {} } });
    expect(result.ok).toBe(true);
    expect(calls.map((call) => call.model)).toEqual(["vision/first", "vision/second", "text/glm-5.2"]);
    expect(calls[1].body.stream).toBe(false);
    expect(calls[1].body.tools).toBeUndefined();
    expect(findBridgeAttachments(calls[2].body)).toEqual([]);
    expect(calls[2].body.messages[0].content[1].text).toContain("OCR: hello");
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
    expect(calls.map((call) => call.model)).toEqual(["vision/first", "text/glm-5.2"]);
  });
});
