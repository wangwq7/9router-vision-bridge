import { describe, expect, it } from "vitest";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";

describe("account fallback request-shape classification", () => {
  it("does not lock a healthy model for leaked multimodal input", () => {
    expect(checkFallbackError(400, "Model only support text input", 3)).toEqual({
      shouldFallback: false,
      cooldownMs: 0,
      newBackoffLevel: 3,
    });
  });

  it("keeps fallback behavior for actual capacity errors", () => {
    expect(checkFallbackError(503, "upstream overloaded", 0)).toMatchObject({
      shouldFallback: true,
    });
  });
});
