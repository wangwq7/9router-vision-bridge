import { describe, expect, it } from "vitest";
import { findBridgeAttachments, findBridgeMediaResidue, replaceBridgeAttachments } from "../../src/lib/visionBridge/attachments.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

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

    const result = replaceBridgeAttachments(body, [attachment], new Map([[attachment.id, "A blue square with the word test."]]));
    expect(findBridgeAttachments(result)).toEqual([]);
    expect(result.messages[0].content[1].text).toContain("untrusted=true");
    expect(result.messages[0].content[1].text).toContain("A blue square");
  });

  it("requires a transcription for every attachment", () => {
    const body = { input: [{ role: "user", content: [{ type: "input_image", image_url: "data:image/png;base64,YWJj" }] }] };
    const attachments = findBridgeAttachments(body, FORMATS.OPENAI_RESPONSES);
    expect(() => replaceBridgeAttachments(body, attachments, new Map())).toThrow("Missing transcription");
  });

  it("finds and replaces an image nested in Claude tool_result content", () => {
    const body = {
      messages: [{
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: "toolu_1",
          content: [
            { type: "text", text: "Screenshot captured" },
            { type: "image", source: { type: "base64", media_type: "image/png", data: "bmVzdGVk" } },
          ],
        }],
      }],
    };

    const [attachment] = findBridgeAttachments(body, FORMATS.CLAUDE);
    expect(attachment).toMatchObject({
      format: "claude",
      itemIndex: 0,
      path: ["messages", 0, "content", 0, "content", 1],
      pathLabel: "messages[0].content[0].content[1]",
      modality: "vision",
    });

    const result = replaceBridgeAttachments(body, [attachment], new Map([[attachment.id, "Terminal error dialog."]]));
    expect(result.messages[0].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_1" });
    expect(result.messages[0].content[0].content[0]).toEqual({ type: "text", text: "Screenshot captured" });
    expect(result.messages[0].content[0].content[1].text).toContain("Terminal error dialog");
    expect(findBridgeAttachments(result, FORMATS.CLAUDE)).toEqual([]);
    expect(findBridgeMediaResidue(result, FORMATS.CLAUDE)).toEqual([]);
  });

  it("uses the explicit Claude adapter instead of guessing from top-level media", () => {
    const body = {
      messages: [{ role: "user", content: [{
        type: "tool_result",
        tool_use_id: "toolu_2",
        content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: "cGRm" } }],
      }] }],
    };
    const [attachment] = findBridgeAttachments(body, FORMATS.CLAUDE);
    expect(attachment).toMatchObject({ format: "claude", modality: "pdf" });
  });

  it("reports media in an unsupported nested container without rewriting it", () => {
    const body = {
      messages: [{ role: "user", content: [{
        type: "custom_container",
        payload: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "eA==" } }],
      }] }],
    };
    expect(findBridgeAttachments(body, FORMATS.CLAUDE)).toEqual([]);
    expect(findBridgeMediaResidue(body, FORMATS.CLAUDE)[0].pathLabel)
      .toBe("messages[0].content[0].payload[0]");
  });
});
