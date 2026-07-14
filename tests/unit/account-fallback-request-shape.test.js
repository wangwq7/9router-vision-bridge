import { describe, expect, it } from "vitest";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";

describe("account fallback request-shape classification", () => {
  it("does not lock a healthy model for leaked multimodal input", () => {
    expect(checkFallbackError(400, "Model only support text input", 3)).toEqual({
      shouldFallback: false,
      shouldModelFallback: false,
      cooldownMs: 0,
      newBackoffLevel: 3,
    });
  });

  it("keeps fallback behavior for actual capacity errors", () => {
    expect(checkFallbackError(503, "upstream overloaded", 0)).toMatchObject({
      shouldFallback: true,
      shouldModelFallback: true,
    });
  });

  it.each([
    "Image dimensions 1x1 are too small. Both width and height must be at least 8 pixels.",
    "Unsupported image format: image/tiff",
    "Failed to decode image data",
    "Invalid image payload",
  ])("does not lock an account but permits model fallback for: %s", (message) => {
    expect(checkFallbackError(400, message, 1)).toMatchObject({
      shouldFallback: false,
      shouldModelFallback: true,
      cooldownMs: 0,
      newBackoffLevel: 1,
    });
  });
});
