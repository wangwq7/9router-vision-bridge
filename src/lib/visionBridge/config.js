// Shared validation and defaults for the Vision Bridge profile API and router.
// Keeping this outside the dashboard prevents invalid settings from reaching the
// request path when profiles are created through the API directly.

export const VISION_BRIDGE_NAME_RE = /^[a-zA-Z0-9_.-]+$/;
export const MAX_VISION_MODELS = 4;
export const VISION_BRIDGE_PROMPT_VERSION = "v1";

export const DEFAULT_VISION_BRIDGE_CONFIG = {
  primaryModel: "",
  primaryContextTokens: 1048576,
  primaryContextBudgetTokens: 930000,
  textFallbackModels: [],
  visionModels: [],
  visionContextBudgetTokens: 180000,
  attachmentCacheTtlHours: 72,
  attachmentCacheMaxEntries: 2000,
  historyAttachmentMode: "onDemand",
  historyAttachmentCompactChars: 600,
  historyAttachmentRestoreMaxAttachments: 2,
  autoCompressionEnabled: true,
  autoCompressionThresholdTokens: 720000,
  autoCompressionTargetTokens: 12000,
  autoCompressionKeepRecentTurns: 8,
  autoCompressionModel: "",
  maxConcurrentExtractions: 2,
  maxAttachmentsPerRequest: 8,
  maxPdfPagesPerRequest: 32,
  strictVisionFailure: true,
};

const INTEGER_RANGES = {
  primaryContextTokens: [32768, 2097152],
  primaryContextBudgetTokens: [16384, 2097152],
  visionContextBudgetTokens: [4096, 1048576],
  attachmentCacheTtlHours: [1, 24 * 365],
  attachmentCacheMaxEntries: [0, 100000],
  historyAttachmentCompactChars: [120, 4000],
  historyAttachmentRestoreMaxAttachments: [1, 16],
  autoCompressionThresholdTokens: [4096, 2097152],
  autoCompressionTargetTokens: [1024, 65536],
  autoCompressionKeepRecentTurns: [1, 64],
  maxConcurrentExtractions: [1, 8],
  maxAttachmentsPerRequest: [1, 64],
  maxPdfPagesPerRequest: [1, 1000],
};

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function assertInteger(value, label, [min, max]) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function normalizeModelList(models, label) {
  if (!Array.isArray(models)) throw new Error(`${label} must be an array`);
  const normalized = models.map((model) => assertString(model, label));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} cannot contain duplicates`);
  return normalized;
}

function normalizeVisionModel(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`visionModels[${index}] must be an object`);
  }
  const model = assertString(value.model, `visionModels[${index}].model`);
  const contextTokens = assertInteger(value.contextTokens ?? 262144, `visionModels[${index}].contextTokens`, [32768, 1048576]);
  const contextBudgetTokens = assertInteger(value.contextBudgetTokens ?? Math.min(180000, contextTokens - 8192), `visionModels[${index}].contextBudgetTokens`, [4096, contextTokens - 1024]);
  const timeoutMs = assertInteger(value.timeoutMs ?? 30000, `visionModels[${index}].timeoutMs`, [1000, 120000]);
  const maxOutputTokens = assertInteger(value.maxOutputTokens ?? 8000, `visionModels[${index}].maxOutputTokens`, [256, 65536]);
  return { model, contextTokens, contextBudgetTokens, timeoutMs, maxOutputTokens, enabled: value.enabled !== false };
}

export function normalizeVisionBridgeConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("config must be an object");
  const config = { ...DEFAULT_VISION_BRIDGE_CONFIG, ...input };
  // These defaults must remain valid when a profile intentionally uses a
  // smaller primary working budget than the global one-million-token default.
  if (input.autoCompressionThresholdTokens == null) {
    config.autoCompressionThresholdTokens = Math.min(DEFAULT_VISION_BRIDGE_CONFIG.autoCompressionThresholdTokens, Number(config.primaryContextBudgetTokens) - 1024);
  }
  if (input.autoCompressionTargetTokens == null) {
    config.autoCompressionTargetTokens = Math.min(DEFAULT_VISION_BRIDGE_CONFIG.autoCompressionTargetTokens, Number(config.autoCompressionThresholdTokens) - 1024);
  }
  config.primaryModel = assertString(config.primaryModel, "primaryModel");
  config.textFallbackModels = normalizeModelList(config.textFallbackModels, "textFallbackModels");
  config.visionModels = config.visionModels.map(normalizeVisionModel);
  if (config.visionModels.length === 0) throw new Error("at least one vision model is required");
  if (config.visionModels.length > MAX_VISION_MODELS) throw new Error(`at most ${MAX_VISION_MODELS} vision models are supported`);

  for (const [key, range] of Object.entries(INTEGER_RANGES)) config[key] = assertInteger(config[key], key, range);
  if (!["retain", "onDemand"].includes(config.historyAttachmentMode)) {
    throw new Error("historyAttachmentMode must be retain or onDemand");
  }
  if (typeof config.autoCompressionEnabled !== "boolean") throw new Error("autoCompressionEnabled must be boolean");
  if (typeof config.autoCompressionModel !== "string") throw new Error("autoCompressionModel must be a string");
  config.autoCompressionModel = config.autoCompressionModel.trim();
  if (config.primaryContextBudgetTokens >= config.primaryContextTokens) {
    throw new Error("primaryContextBudgetTokens must be lower than primaryContextTokens");
  }
  if (config.autoCompressionThresholdTokens >= config.primaryContextBudgetTokens) {
    throw new Error("autoCompressionThresholdTokens must be lower than primaryContextBudgetTokens");
  }
  if (config.autoCompressionTargetTokens >= config.autoCompressionThresholdTokens) {
    throw new Error("autoCompressionTargetTokens must be lower than autoCompressionThresholdTokens");
  }
  if (typeof config.strictVisionFailure !== "boolean") throw new Error("strictVisionFailure must be boolean");

  const visionNames = config.visionModels.map((entry) => entry.model);
  if (new Set(visionNames).size !== visionNames.length) throw new Error("visionModels cannot contain duplicate models");
  if (visionNames.includes(config.primaryModel) || config.textFallbackModels.includes(config.primaryModel)) {
    throw new Error("primaryModel cannot also be a fallback or vision model");
  }
  if (config.textFallbackModels.some((model) => visionNames.includes(model))) {
    throw new Error("a model cannot be both a text fallback and a vision model");
  }
  if (config.autoCompressionModel && visionNames.includes(config.autoCompressionModel)) {
    throw new Error("autoCompressionModel cannot be a vision model");
  }
  return config;
}

export function normalizeVisionBridgeProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("profile must be an object");
  const name = assertString(input.name, "name");
  if (!VISION_BRIDGE_NAME_RE.test(name)) throw new Error("name can only contain letters, numbers, -, _ and .");
  if (name.includes("/")) throw new Error("name cannot contain /");
  if (input.enabled != null && typeof input.enabled !== "boolean") throw new Error("enabled must be boolean");
  return { name, enabled: input.enabled !== false, config: normalizeVisionBridgeConfig(input.config) };
}
