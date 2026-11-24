// Scenario defaults and validation. Pure functions (no ego, no fs).

export const STEP_KEYS = new Set([
  "id", "scene", "page", "goto", "click", "fill", "paste", "type", "press", "select", "scroll", "wait",
  "expect", "caption", "highlight", "hold", "capture", "dryRun", "note", "bridge", "sweep",
]);
export const TOP_KEYS = new Set([
  "name", "viewport", "output", "vars", "redact", "redactFixed", "steps", "note", "flow", "intro", "outro",
]);
const ACTIONS = ["goto", "click", "fill", "paste", "type", "press", "select", "scroll", "wait"];
const CIRCLED = "①②③④⑤⑥⑦⑧⑨";

export function defaultHold(caption) {
  // reading time: ~9 Korean chars per second plus a second to notice the caption (user 2026-11-24: "좀 더 여유있게")
  return caption ? Math.max(2800, [...caption].length * 110 + 1000) : 1500;
}

export function circledNumbers(text) {
  const out = new Set();
  for (const ch of text || "") {
    const k = CIRCLED.indexOf(ch);
    if (k >= 0) out.add(k + 1);
  }
  return out;
}

// Replace ${name} with vars[name]. Unknown names stay as they are.
export function subst(value, vars) {
  if (typeof value === "string") {
    return value.replace(/\$\{([\w:]+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }
  if (Array.isArray(value)) return value.map((v) => subst(v, vars));
  if (value && typeof value === "object") {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = subst(v, vars);
    return o;
  }
  return value;
}

export function normalize(input, overrideVars = {}) {
  const errors = [];
  const warnings = [];
  const sc = structuredClone(input || {});
  for (const k of Object.keys(sc)) if (!TOP_KEYS.has(k)) errors.push(`알 수 없는 최상위 키: ${k}`);
  if (!sc.name) errors.push("name이 없습니다");
  sc.viewport = { width: 1920, height: 1080, dpr: 1, ...(sc.viewport || {}) }; // 100 % (사용자 2026-11-24). 글자를 키우려면 1280×720 @1.5
  sc.output = { fps: 30, ...(sc.output || {}) };
  sc.vars = { ...(sc.vars || {}), ...overrideVars };
  sc.redact = (sc.redact || []).map((r, i) => {
    if (!r.selector && !r.text && !r.pattern) errors.push(`redact[${i}]: selector, text, pattern 중 하나가 필요합니다`);
    return { url: ".", mode: "blur", required: true, ...r };
  });
  sc.redactFixed = sc.redactFixed || [];
  if (!Array.isArray(sc.steps) || sc.steps.length === 0) errors.push("steps가 비어 있습니다");
  sc.steps = sc.steps || [];

  const ids = new Set();
  let lastPage = null;
  let lastScene = "";
  sc.steps = sc.steps.map((st, i) => {
    const where = `steps[${i}]${st.id ? `(${st.id})` : ""}`;
    for (const k of Object.keys(st)) if (!STEP_KEYS.has(k)) errors.push(`${where}: 알 수 없는 키 ${k}`);
    const id = st.id || `s${i + 1}`;
    if (ids.has(id)) errors.push(`${where}: id 중복 ${id}`);
    ids.add(id);
    const actions = ACTIONS.filter((a) => a in st);
    if (actions.length > 1) errors.push(`${where}: 동작은 하나만 (${actions.join(", ")})`);
    const page = st.page || lastPage;
    if (!page) errors.push(`${where}: page가 없습니다 (첫 단계에는 꼭 필요)`);
    lastPage = st.click && typeof st.click === "object" && st.click.opens ? st.click.opens : page;
    const scene = st.scene || lastScene;
    lastScene = scene;
    const highlight = (st.highlight || []).map((h) =>
      typeof h === "string" || h.css || h.text ? (h.target ? h : { target: h }) : h,
    );
    for (const h of highlight) if (!h.target) errors.push(`${where}: highlight에 target이 없습니다`);
    const capNums = circledNumbers(st.caption);
    const boxNums = new Set(highlight.filter((h) => h.n).map((h) => h.n));
    const same = capNums.size === boxNums.size && [...capNums].every((n) => boxNums.has(n));
    if (!same) {
      errors.push(
        `${where}: 자막 번호(${[...capNums].join(",") || "없음"})와 상자 번호(${[...boxNums].join(",") || "없음"})가 다릅니다`,
      );
    }
    if (st.wait) {
      const w = st.wait;
      if (!w.ms && !w.until) errors.push(`${where}: wait에는 ms나 until이 필요합니다`);
      const edit = w.edit ?? "keep";
      if (!(edit === "keep" || edit === "cut" || (edit && typeof edit.speed === "number"))) {
        errors.push(`${where}: wait.edit은 "keep" | "cut" | {speed: k}`);
      }
    }
    if (st.click && typeof st.click === "object" && !st.click.target && !st.click.css && !st.click.text) {
      errors.push(`${where}: click에 target이 없습니다`);
    }
    return {
      ...st,
      id,
      page,
      scene,
      highlight,
      hold: st.hold ?? defaultHold(st.caption),
    };
  });
  return { scenario: sc, errors, warnings };
}

// A target is a selector string ("css", "text=...") or {css?, text?}. Normalise to {css, text}.
export function parseTarget(t) {
  if (t && typeof t === "object") {
    if (t.target) return parseTarget(t.target);
    return { css: t.css || null, text: t.text || null };
  }
  if (typeof t === "string" && t.startsWith("text=")) return { css: null, text: t.slice(5).replace(/^"|"$/g, "") };
  return { css: t, text: null };
}
