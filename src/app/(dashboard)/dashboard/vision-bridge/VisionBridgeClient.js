"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, ModelSelectModal, Toggle } from "@/shared/components";

const createVisionModel = (model = "") => ({
  model,
  contextTokens: 262144,
  contextBudgetTokens: 180000,
  timeoutMs: 30000,
  maxOutputTokens: 512,
  enabled: true,
});

const defaults = () => ({
  name: "glm-vision-bridge",
  enabled: true,
  primaryModel: "",
  textFallbackModels: [],
  visionModels: [createVisionModel()],
  primaryContextTokens: 1048576,
  primaryContextBudgetTokens: 930000,
  attachmentCacheTtlHours: 72,
  maxConcurrentExtractions: 2,
  maxAttachmentsPerRequest: 8,
  strictVisionFailure: true,
});

function modelName(value, emptyText = "尚未选择") {
  return value?.trim() || emptyText;
}

function ModelPicker({ label, value, hint, onOpen, onClear, required = false }) {
  return <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-text-main">{label}{required && <span className="ml-1 text-red-500">*</span>}</label>
      {value && onClear && <button type="button" onClick={onClear} className="text-xs text-text-muted hover:text-red-500">清除</button>}
    </div>
    <button type="button" onClick={onOpen} className="group flex min-h-11 items-center justify-between gap-3 rounded-[10px] border border-border bg-surface-2 px-3 text-left transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
      <span className={value ? "truncate font-mono text-sm text-text-main" : "text-sm text-text-muted"}>{modelName(value, "从已连接模型中选择")}</span>
      <span className="material-symbols-outlined shrink-0 text-[20px] text-text-muted transition-transform group-hover:translate-y-px">expand_more</span>
    </button>
    {hint && <p className="text-xs leading-5 text-text-muted">{hint}</p>}
  </div>;
}

function FlowDivider({ label }) {
  return <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-text-muted lg:flex-col lg:py-0">
    <span className="material-symbols-outlined text-[19px] lg:text-[22px]">arrow_forward</span>
    {label && <span className="whitespace-nowrap">{label}</span>}
  </div>;
}

function RouteNode({ eyebrow, model, icon, tone = "default", detail, compact = false }) {
  const tones = {
    default: "border-border bg-surface",
    vision: "border-amber-500/25 bg-amber-500/5",
    primary: "border-primary/30 bg-primary/5",
    fallback: "border-border border-dashed bg-surface-2",
  };
  return <div className={`rounded-lg border px-3 py-2.5 ${tones[tone]} ${compact ? "" : "min-h-[92px]"}`}>
    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-text-muted"><span className="material-symbols-outlined text-[16px]">{icon}</span>{eyebrow}</div>
    <p className="truncate font-mono text-sm font-semibold leading-5 text-text-main" title={model}>{modelName(model)}</p>
    {detail && <p className="mt-1 text-[11px] leading-4 text-text-muted">{detail}</p>}
  </div>;
}

function RoutePreview({ form, compact = false }) {
  const visualModels = form.visionModels.filter((entry) => entry.model && entry.enabled !== false);
  const textFallbacks = form.textFallbackModels.filter(Boolean);
  const visualLabel = visualModels.length ? `${visualModels.length} 个模型，按顺序回退` : "尚未选择视觉模型";
  const textLabel = textFallbacks.length ? `主模型失败后，依次尝试 ${textFallbacks.length} 个备用模型` : "无文本备用模型";
  return <div className={compact ? "mt-3" : "mt-4"}>
    {!compact && <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-5 text-text-muted"><span className="material-symbols-outlined mt-0.5 text-[15px] text-primary">info</span><span>纯文本请求直接进入主文本模型；含附件的请求先经过视觉回退组，提取文本后再交由主文本模型完成任务。</span></div>}
    <div className="grid items-stretch gap-2 lg:grid-cols-[minmax(170px,.9fr)_auto_minmax(280px,1.45fr)_auto_minmax(210px,1fr)] lg:gap-3">
      <RouteNode eyebrow="对外调用" model={form.name} icon="send" detail={compact ? null : "客户端始终调用这个桥接模型"} compact={compact} />
      <FlowDivider label={compact ? null : "含附件时"} />
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.035] p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[11px] text-text-muted"><span className="material-symbols-outlined text-[16px]">visibility</span>视觉识别回退组</div><span className="text-[10px] text-text-muted">{visualLabel}</span></div>
        <div className="space-y-2">
          {visualModels.length ? visualModels.map((entry, index) => <div key={`${entry.model}-${index}`} className="flex items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-semibold text-amber-700 dark:text-amber-300">{index + 1}</span>
            <div className="min-w-0 flex-1 rounded-md border border-amber-500/15 bg-surface/80 px-2.5 py-2"><p className="truncate font-mono text-xs font-semibold text-text-main">{entry.model}</p>{!compact && <p className="mt-0.5 text-[10px] text-text-muted">{Math.round(entry.timeoutMs / 1000)} 秒超时 · 提取上限 {entry.maxOutputTokens} tokens</p>}</div>
          </div>) : <div className="rounded-md border border-dashed border-border px-2.5 py-3 text-xs text-text-muted">请先选择至少一个视觉模型</div>}
        </div>
      </div>
      <FlowDivider label={compact ? null : "转写为文本"} />
      <div className="rounded-xl border border-primary/25 bg-primary/[0.035] p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-text-muted"><span className="material-symbols-outlined text-[16px]">psychology</span>最终答复</div>
        <RouteNode eyebrow="主文本模型" model={form.primaryModel} icon="stars" tone="primary" detail={compact ? null : "结合对话与提取文本生成最终回答"} compact />
        {textFallbacks.length ? <div className="mt-2 border-t border-primary/15 pt-2"><p className="mb-1.5 text-[10px] text-text-muted">{textLabel}</p><div className="space-y-1">{textFallbacks.map((model, index) => <div key={`${model}-${index}`} className="truncate rounded-md bg-surface/70 px-2 py-1.5 font-mono text-[11px] text-text-main">{index + 1}. {model}</div>)}</div></div> : !compact && <p className="mt-2 text-[10px] text-text-muted">{textLabel}</p>}
      </div>
    </div>
  </div>;
}

export default function VisionBridgeClient() {
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState(defaults);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeProviders, setActiveProviders] = useState([]);
  const [modelAliases, setModelAliases] = useState({});
  const [picker, setPicker] = useState(null);

  const refresh = useCallback(async () => {
    const [profilesRes, providersRes, aliasesRes] = await Promise.all([
      fetch("/api/vision-bridge", { cache: "no-store" }),
      fetch("/api/providers"),
      fetch("/api/models/alias"),
    ]);
    if (profilesRes.ok) setProfiles((await profilesRes.json()).profiles || []);
    if (providersRes.ok) setActiveProviders((await providersRes.json()).connections || []);
    if (aliasesRes.ok) setModelAliases((await aliasesRes.json()).aliases || {});
  }, []);

  useEffect(() => { refresh().catch(() => setError("无法读取视觉桥接配置，请刷新后重试。 ")).finally(() => setLoading(false)); }, [refresh]);

  const chosenModels = useMemo(() => [form.primaryModel, ...form.textFallbackModels, ...form.visionModels.map((entry) => entry.model)].filter(Boolean), [form]);
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const chooseModel = (selected) => {
    const model = selected?.value || "";
    if (!model || !picker) return;
    setError("");
    setForm((current) => {
      if (picker.type === "primary") return { ...current, primaryModel: model };
      if (picker.type === "textFallback") {
        if (current.textFallbackModels.includes(model)) return current;
        return { ...current, textFallbackModels: [...current.textFallbackModels, model] };
      }
      const visionModels = current.visionModels.map((entry, index) => index === picker.index ? { ...entry, model } : entry);
      return { ...current, visionModels };
    });
    setPicker(null);
  };

  const updateVision = (index, patch) => setForm((current) => ({ ...current, visionModels: current.visionModels.map((entry, itemIndex) => itemIndex === index ? { ...entry, ...patch } : entry) }));
  const removeVision = (index) => setForm((current) => ({ ...current, visionModels: current.visionModels.filter((_, itemIndex) => itemIndex !== index) }));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const visionModels = form.visionModels.filter((entry) => entry.model).map((entry) => ({
        ...entry,
        contextTokens: Number(entry.contextTokens),
        contextBudgetTokens: Number(entry.contextBudgetTokens),
        timeoutMs: Number(entry.timeoutMs),
        maxOutputTokens: Number(entry.maxOutputTokens),
      }));
      const payload = {
        name: form.name,
        enabled: form.enabled,
        config: {
          primaryModel: form.primaryModel,
          textFallbackModels: form.textFallbackModels,
          visionModels,
          primaryContextTokens: Number(form.primaryContextTokens),
          primaryContextBudgetTokens: Number(form.primaryContextBudgetTokens),
          visionContextBudgetTokens: 180000,
          attachmentCacheTtlHours: Number(form.attachmentCacheTtlHours),
          attachmentCacheMaxEntries: 2000,
          maxConcurrentExtractions: Number(form.maxConcurrentExtractions),
          maxAttachmentsPerRequest: Number(form.maxAttachmentsPerRequest),
          maxPdfPagesPerRequest: 32,
          strictVisionFailure: form.strictVisionFailure,
        },
      };
      const response = await fetch(editingId ? `/api/vision-bridge/${editingId}` : "/api/vision-bridge", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      setForm(defaults());
      setEditingId(null);
      await refresh();
    } catch (saveError) {
      setError(saveError.message || "保存失败，请检查模型和参数。 ");
    } finally {
      setBusy(false);
    }
  };

  const edit = (profile) => {
    const config = profile.config;
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      enabled: profile.enabled,
      primaryModel: config.primaryModel,
      textFallbackModels: config.textFallbackModels || [],
      visionModels: (config.visionModels || []).map((entry) => ({ ...createVisionModel(), ...entry })),
      primaryContextTokens: config.primaryContextTokens,
      primaryContextBudgetTokens: config.primaryContextBudgetTokens,
      attachmentCacheTtlHours: config.attachmentCacheTtlHours,
      maxConcurrentExtractions: config.maxConcurrentExtractions,
      maxAttachmentsPerRequest: config.maxAttachmentsPerRequest,
      strictVisionFailure: config.strictVisionFailure,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id) => {
    if (!confirm("确定删除这个视觉桥接配置吗？外部模型名将立即不可用。")) return;
    const response = await fetch(`/api/vision-bridge/${id}`, { method: "DELETE" });
    if (response.ok) await refresh();
  };

  const pickerTitle = picker?.type === "primary" ? "选择主文本模型" : picker?.type === "textFallback" ? "添加文本备用模型" : "选择视觉模型";

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-3 border-b border-border-subtle pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary"><span className="material-symbols-outlined text-[22px]">account_tree</span><span className="text-xs font-semibold tracking-[0.16em]">VISION BRIDGE</span></div>
        <h2 className="text-2xl font-semibold tracking-tight text-text-main">视觉桥接</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">将图片等附件交给视觉模型识别并转写为不可信文本，再由指定的主文本模型完成最终任务。这样即使 GLM-5.2 不支持多模态，也始终保持为主要推理模型。</p>
      </div>
      <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-5 text-text-muted"><span className="font-medium text-text-main">对外模型名：</span><code className="font-mono text-primary">{form.name || "glm-vision-bridge"}</code><br />Agent、Claude Code 等客户端填写此名称即可。</div>
    </div>

    <Card className="overflow-hidden">
      <div className="border-b border-border-subtle bg-surface-2 px-5 py-4"><h3 className="font-semibold text-text-main">{editingId ? "编辑视觉桥接配置" : "新建视觉桥接配置"}</h3><p className="mt-1 text-xs leading-5 text-text-muted">按从上到下的顺序选择模型。所有模型从当前已连接的提供商中选择，无需手动输入模型名。</p></div>
      <div className="space-y-7 p-5">
        <section className="space-y-4"><div><h4 className="font-medium text-text-main">1. 对外入口与最终答复</h4><p className="mt-1 text-xs leading-5 text-text-muted">外部客户端始终调用同一个桥接模型；无论是否包含图片，最终回答优先交给主文本模型。</p></div><div className="grid gap-4 md:grid-cols-2"><Input label="对外模型名称" hint="仅限字母、数字、点、连字符和下划线；客户端调用时使用它。" value={form.name} onChange={(event) => setField("name", event.target.value)} /><ModelPicker label="主文本模型" required value={form.primaryModel} hint="附件被转成文本后，由此模型结合完整对话给出最终答案。" onOpen={() => setPicker({ type: "primary" })} onClear={() => setField("primaryModel", "")} /></div></section>

        <section className="space-y-4 border-t border-border-subtle pt-6"><div><h4 className="font-medium text-text-main">2. 视觉识别回退队列</h4><p className="mt-1 text-xs leading-5 text-text-muted">第一个模型优先处理附件；遇到超时、限流、空输出或上游错误时，自动尝试下一个。最多配置 4 个。</p></div><div className="space-y-3">{form.visionModels.map((entry, index) => <div key={index} className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start"><div className="min-w-0 flex-1"><ModelPicker label={index === 0 ? "首选视觉模型" : `备用视觉模型 ${index}`} required value={entry.model} hint={index === 0 ? "建议选择已验证可识图且延迟稳定的模型。" : "仅在前序视觉模型不可用或未产生文本时调用。"} onOpen={() => setPicker({ type: "vision", index })} onClear={() => updateVision(index, { model: "" })} /></div><div className="flex items-center gap-2 pt-1"><Toggle checked={entry.enabled !== false} onChange={(enabled) => updateVision(index, { enabled })} label="启用" /><Button variant="ghost" size="sm" disabled={form.visionModels.length === 1} onClick={() => removeVision(index)}>删除</Button></div></div><details className="mt-4 rounded-lg bg-surface-2 px-3 py-2"><summary className="cursor-pointer text-xs font-medium text-text-main">高级识别参数</summary><p className="mt-1 text-xs leading-5 text-text-muted">截图建议将输出上限设为 512；复杂图片或表格可适当提高。超时后会立即进入下一备用模型。</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Input label="模型上下文上限" type="number" value={entry.contextTokens} onChange={(event) => updateVision(index, { contextTokens: event.target.value })} /><Input label="工作预算" type="number" value={entry.contextBudgetTokens} onChange={(event) => updateVision(index, { contextBudgetTokens: event.target.value })} /><Input label="超时（毫秒）" type="number" value={entry.timeoutMs} onChange={(event) => updateVision(index, { timeoutMs: event.target.value })} /><Input label="提取输出上限" type="number" value={entry.maxOutputTokens} onChange={(event) => updateVision(index, { maxOutputTokens: event.target.value })} /></div></details></div>)}</div>{form.visionModels.length < 4 && <Button variant="ghost" size="sm" onClick={() => setForm((current) => ({ ...current, visionModels: [...current.visionModels, createVisionModel()] }))}><span className="material-symbols-outlined mr-1 text-[17px]">add</span>添加备用视觉模型</Button>}</section>

        <section className="space-y-4 border-t border-border-subtle pt-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h4 className="font-medium text-text-main">3. 文本模型备用队列</h4><p className="mt-1 text-xs leading-5 text-text-muted">只有在视觉提取已经成功、但主文本模型不可用时才会使用。不会替代视觉模型。</p></div><Button variant="ghost" size="sm" onClick={() => setPicker({ type: "textFallback" })}><span className="material-symbols-outlined mr-1 text-[17px]">add</span>添加文本备用模型</Button></div>{form.textFallbackModels.length ? <div className="flex flex-wrap gap-2">{form.textFallbackModels.map((model, index) => <span key={`${model}-${index}`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text-main">{model}<button type="button" onClick={() => setField("textFallbackModels", form.textFallbackModels.filter((_, itemIndex) => itemIndex !== index))} className="material-symbols-outlined text-[15px] text-text-muted hover:text-red-500">close</button></span>)}</div> : <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-text-muted">未设置文本备用模型。主文本模型失败时将直接返回错误。</p>}</section>

        <section className="space-y-4 border-t border-border-subtle pt-6"><div><h4 className="font-medium text-text-main">4. 容量、缓存与安全策略</h4><p className="mt-1 text-xs leading-5 text-text-muted">主模型工作预算用于防止转写文本挤占对话上下文；缓存可避免同一附件被重复识别。</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Input label="主模型上下文上限" type="number" value={form.primaryContextTokens} onChange={(event) => setField("primaryContextTokens", event.target.value)} /><Input label="主模型工作预算" type="number" value={form.primaryContextBudgetTokens} onChange={(event) => setField("primaryContextBudgetTokens", event.target.value)} /><Input label="附件缓存时长（小时）" type="number" value={form.attachmentCacheTtlHours} onChange={(event) => setField("attachmentCacheTtlHours", event.target.value)} /><Input label="并发识别数" type="number" value={form.maxConcurrentExtractions} onChange={(event) => setField("maxConcurrentExtractions", event.target.value)} /></div><div className="grid gap-4 md:grid-cols-2"><Input label="单请求最大附件数" type="number" value={form.maxAttachmentsPerRequest} onChange={(event) => setField("maxAttachmentsPerRequest", event.target.value)} /><Toggle checked={form.strictVisionFailure} onChange={(strictVisionFailure) => setField("strictVisionFailure", strictVisionFailure)} label="严格处理视觉失败" description="所有视觉模型均无法提取附件时直接报错，不让主文本模型猜测附件内容。" /></div></section>

        <section className="border-t border-border-subtle pt-6"><div className="flex items-center justify-between gap-3"><div><h4 className="font-medium text-text-main">当前路由预览</h4><p className="mt-1 text-xs text-text-muted">保存后将按下图执行。编辑配置时预览会随选择实时更新。</p></div><span className={`rounded-full px-2 py-1 text-xs ${form.enabled ? "bg-success/10 text-success" : "bg-surface-2 text-text-muted"}`}>{form.enabled ? "已启用" : "未启用"}</span></div><RoutePreview form={form} /></section>

        {error && <p className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-sm text-red-500">{error}</p>}
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-5 sm:flex-row"><Button onClick={save} loading={busy}>{editingId ? "保存修改" : "创建视觉桥接"}</Button>{editingId && <Button variant="ghost" onClick={() => { setEditingId(null); setForm(defaults()); setError(""); }}>取消编辑</Button>}<Toggle checked={form.enabled} onChange={(enabled) => setField("enabled", enabled)} label="启用此桥接模型" /></div>
      </div>
    </Card>

    <section className="space-y-3"><div><h3 className="font-semibold text-text-main">已保存的桥接模型</h3><p className="mt-1 text-xs text-text-muted">这里展示生产中实际生效的模型队列。点击编辑可调整模型顺序和参数。</p></div>{loading ? <Card className="p-5 text-sm text-text-muted">正在读取配置…</Card> : profiles.length ? profiles.map((profile) => <Card key={profile.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2"><code className="font-mono text-sm font-semibold text-text-main">{profile.name}</code><span className={`rounded-full px-2 py-0.5 text-[11px] ${profile.enabled ? "bg-success/10 text-success" : "bg-surface-2 text-text-muted"}`}>{profile.enabled ? "已启用" : "已停用"}</span></div><p className="mt-2 text-xs leading-5 text-text-muted">主文本模型：<span className="font-mono text-text-main">{profile.config.primaryModel}</span> · 视觉队列：<span className="font-mono text-text-main">{profile.config.visionModels?.map((entry) => entry.model).join(" → ") || "未配置"}</span></p></div><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => edit(profile)}>编辑</Button><Button size="sm" variant="ghost" onClick={() => remove(profile.id)}>删除</Button></div></div><RoutePreview form={{ ...profile.config, name: profile.name }} compact /></Card>) : <Card className="p-5 text-sm text-text-muted">尚未创建视觉桥接模型。</Card>}</section>

    <ModelSelectModal isOpen={!!picker} onClose={() => setPicker(null)} onSelect={chooseModel} activeProviders={activeProviders} modelAliases={modelAliases} title={pickerTitle} addedModelValues={chosenModels} closeOnSelect locale="zh" />
  </div>;
}
