import { describe, expect, it } from "vitest";
import { findBridgeAttachments, replaceBridgeAttachments } from "../../src/lib/visionBridge/attachments.js";

describe("Vision Bridge attachment normalization", () => {
  it("replaces Claude image blocks with explicitly untrusted text", () => {
    const body = {
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Please inspect this." },
          { type: "image", source: { type: "base64", media_type: "image/png", data: "YWJj" } },
        ],
      }],
    };
    const [attachment] = findBridgeAttachments(body);
    expect(attachment).toMatchObject({ format: "claude", modality: "vision" });
    expect(attachment.cacheKey).toHaveLength(64);

    const result = replaceBridgeAttachments(body, new Map([[attachment.id, "A blue square with the word test."]]));
    expect(findBridgeAttachments(result)).toEqual([]);
    expect(result.messages[0].content[1].text).toContain("untrusted=true");
    expect(result.messages[0].content[1].text).toContain("A blue square");
  });

  it("requires a transcription for every attachment", () => {
    const body = { input: [{ role: "user", content: [{ type: "input_image", image_url: "data:image/png;base64,YWJj" }] }] };
    expect(() => replaceBridgeAttachments(body, new Map())).toThrow("Missing transcription");
  });
});
