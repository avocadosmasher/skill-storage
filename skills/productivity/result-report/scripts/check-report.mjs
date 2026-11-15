#!/usr/bin/env node
// result-report 보고서가 디자인 명세(references/design.md)를 지키는지 검사한다.
// 사용: node scripts/check-report.mjs <보고서.html>
// 실패가 하나라도 있으면 종료 코드 1. 경고는 종료 코드에 영향을 주지 않는다.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const templatePath = join(here, "..", "assets", "result-report.html");

const target = process.argv[2];
if (!target) {
  console.error("사용: node scripts/check-report.mjs <보고서.html>");
  process.exit(2);
}

const raw = readFileSync(target, "utf8");
const template = readFileSync(templatePath, "utf8");
const fails = [];
const warns = [];

const styleOf = (s) => {
  const m = s.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
};
const textOf = (s) =>
  s
    .replace(/<code>[\s\S]*?<\/code>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const all = (re, s) => [...s.matchAll(re)];

// 그림 SVG에서 선이 출발 · 도착이 아닌 층 패널이나 칸을 가로지르는지 찾는다(diagram-style.md, 설계 003).
// - 흐름 선(화살표가 붙음: marker-start · marker-end)이 가로지르면 실패. 데이터가 그 층 · 칸을 거쳐 가는 것처럼 읽힌다
// - 관계 선(화살표 없는 점선)은 "관련 있음"만 뜻하므로 가로질러도 된다
// - 화살표 없는 실선이 가로지르면 경고. 흐름인데 화살표를 빠뜨렸는지, 관계인데 점선을 빠뜨렸는지 사람이 본다
// 층 패널은 채움 #fafafa + 테두리 #d5d9e0, 칸은 칸 색 다섯 가지의 채움(아직 안 한 것은 점선 테두리 #c8c8c8)인 <rect>.
// 아이콘(aria-hidden 묶음)과 <defs> 안의 선, 채운 도형은 보지 않는다. 곡선 구간은 시작점과 끝점을 잇는 직선으로 본다.
function crossings(svg) {
  const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  const num = (tag, name, d = 0) => parseFloat(attr(tag, name) ?? d);
  const NODE = /^#(eaf2ff|fcebf6|efeafc|f1f1f1)$/i;
  const boxes = [];
  for (const [tag] of all(/<rect\b[^>]*>/g, svg)) {
    const fill = (attr(tag, "fill") || "").toLowerCase();
    const stroke = (attr(tag, "stroke") || "").toLowerCase();
    let kind = null;
    if (fill === "#fafafa" && stroke === "#d5d9e0") kind = "층 패널";
    else if (NODE.test(fill) || (stroke === "#c8c8c8" && /^(#fff|#ffffff|white)$/.test(fill))) kind = "칸";
    if (!kind) continue;
    const x = num(tag, "x"), y = num(tag, "y"), w = num(tag, "width"), h = num(tag, "height");
    if (w > 0 && h > 0) boxes.push({ kind, x, y, w, h });
  }
  const body = svg.replace(/<defs\b[\s\S]*?<\/defs>/g, " ").replace(/<g\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/g>/g, " ");
  const kindOf = (tag) => ({ arrow: /marker-(start|end)=/.test(tag), dashed: /stroke-dasharray="(?!none"|0")[^"]+"/.test(tag) });
  const connectors = [];
  for (const [tag] of all(/<line\b[^>]*>/g, body))
    connectors.push({ ...kindOf(tag), pts: [[num(tag, "x1"), num(tag, "y1")], [num(tag, "x2"), num(tag, "y2")]] });
  for (const [tag] of all(/<path\b[^>]*>/g, body)) {
    if (/\sfill="(?!none")[^"]+"/.test(tag)) continue; // 채운 도형(화살표 머리 등)은 선이 아님
    const pts = [];
    let cx = 0, cy = 0, sx = 0, sy = 0;
    for (const [, cmd, args] of all(/([MLHVQCTSAZmlhvqctsaz])([^MLHVQCTSAZmlhvqctsaz]*)/g, attr(tag, "d") || "")) {
      const n = (args.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const step = { M: 2, L: 2, T: 2, H: 1, V: 1, Q: 4, S: 4, C: 6, A: 7, Z: 0 }[C];
      if (C === "Z") { cx = sx; cy = sy; pts.push([cx, cy]); continue; }
      for (let i = 0; i + step <= n.length; i += step) {
        const g = n.slice(i, i + step);
        if (C === "H") cx = rel ? cx + g[0] : g[0];
        else if (C === "V") cy = rel ? cy + g[0] : g[0];
        else { const ex = g[step - 2], ey = g[step - 1]; cx = rel ? cx + ex : ex; cy = rel ? cy + ey : ey; }
        if (C === "M" && i === 0) { sx = cx; sy = cy; }
        pts.push([cx, cy]);
      }
    }
    if (pts.length > 1) connectors.push({ ...kindOf(tag), pts });
  }
  const near = ([px, py], b, t = 2) => px >= b.x - t && px <= b.x + b.w + t && py >= b.y - t && py <= b.y + b.h + t;
  // 선분이 상자 안쪽(테두리에서 1px 들어간 영역)을 지나는지
  const through = ([x1, y1], [x2, y2], b) => {
    const L = b.x + 1, R = b.x + b.w - 1, T = b.y + 1, B = b.y + b.h - 1;
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    for (const [p, q] of [[-dx, x1 - L], [dx, R - x1], [-dy, y1 - T], [dy, B - y1]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
    return t1 - t0 > 1e-6;
  };
  const bad = [];
  const doubt = [];
  for (const { arrow, dashed, pts } of connectors) {
    if (!arrow && dashed) continue;
    const ends = [pts[0], pts[pts.length - 1]];
    for (const b of boxes) {
      if (ends.some((e) => near(e, b))) continue;
      if (!pts.slice(1).some((p, i) => through(pts[i], p, b))) continue;
      const where = `${b.kind}(x=${b.x}, y=${b.y}), 선 (${ends[0].join(",")}) → (${ends[1].join(",")})`;
      if (arrow) bad.push(`그림 SVG의 흐름 선(화살표)이 출발 · 도착이 아닌 ${where}를 가로지름. 그 층 · 칸 바깥으로 돌려 긋는다`);
      else doubt.push(`그림 SVG의 화살표 없는 실선이 ${where}를 가로지름. 흐름이면 화살표를 달고 바깥으로, "관련 있음"이면 점선으로`);
    }
  }
  return { bad: [...new Set(bad)], doubt: [...new Set(doubt)] };
}

// 0. 1.2 그림의 SVG(figure.fig 안, references/diagram-style.md)는 여기서 따로 검사하고 나머지 검사에서는 뺀다
const FILL = { "b-mine": /#eaf2ff\b/i, "b-peer": /#fcebf6\b/i, "b-both": /#efeafc\b/i, "b-past": /#f1f1f1\b/i, "b-next": /#c8c8c8\b/i };
const figures = all(/<figure class="fig">([\s\S]*?)<\/figure>/g, raw);
const figUsed = new Set();
const svgTexts = [];
for (const [, inner] of figures) {
  const svgs = all(/<svg\b[\s\S]*?<\/svg>/g, inner).map((m) => m[0]);
  if (svgs.length !== 1) {
    fails.push(`그림(figure.fig)에 SVG가 ${svgs.length}개. 정확히 1개`);
    continue;
  }
  const svg = svgs[0];
  const open = svg.match(/<svg\b[^>]*>/)[0];
  const id = open.match(/\sid="([^"]+)"/)?.[1];
  if (!id) fails.push("그림 SVG에 id가 없음");
  if (!/\srole="img"/.test(open)) fails.push('그림 SVG에 role="img"가 없음');
  if (!/\saria-labelledby="[^"]+"/.test(open)) fails.push("그림 SVG에 aria-labelledby가 없음");
  if (!/^<svg\b[^>]*>\s*<title\b/.test(svg)) fails.push("그림 SVG의 첫 자식이 <title>이 아님");
  if (!/<desc\b/.test(svg)) fails.push("그림 SVG에 <desc>가 없음");
  if (/<script|<foreignObject|<image\b/i.test(svg)) fails.push("그림 SVG에 script · foreignObject · image 가 있음");
  if (/\son[a-z]+\s*=/i.test(svg)) fails.push("그림 SVG에 on… 이벤트 속성이 있음");
  if (/href\s*=\s*"\s*https?:|url\(\s*['"]?https?:|@import|@font-face/i.test(svg)) fails.push("그림 SVG가 외부 주소 · 글꼴을 부름");
  for (const [, block] of all(/<style>([\s\S]*?)<\/style>/g, svg)) {
    const css = block.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, prelude] of all(/([^{}]+)\{/g, css)) {
      const p = prelude.trim();
      if (!p || p.startsWith("@") || /^(from|to|\d+%)/.test(p)) continue;
      for (const sel of p.split(","))
        if (id && !sel.trim().startsWith(`#${id}`)) fails.push(`그림 SVG의 <style> 규칙이 #${id} 로 시작하지 않음: ${sel.trim().slice(0, 30)}`);
    }
  }
  for (const [cls, re] of Object.entries(FILL)) if (re.test(svg)) figUsed.add(cls);
  const cross = crossings(svg);
  fails.push(...cross.bad);
  warns.push(...cross.doubt);
  svgTexts.push(svg.replace(/<style>[\s\S]*?<\/style>/g, " "));
}
const html = raw.replace(/(<figure class="fig">[\s\S]*?)<svg\b[\s\S]*?<\/svg>/g, "$1");

// 1. CSS 는 틀 그대로
const style = styleOf(html);
if (style === null) fails.push("<style> 블록이 없음");
else if (style !== styleOf(template)) fails.push("<style> 블록이 틀(assets/result-report.html)과 다름. CSS 는 고치지 않는다");
if (all(/<style/g, html).length > 1) fails.push("<style> 블록이 둘 이상임");

// 2. 금지 요소
if (/<script/i.test(html)) fails.push("<script> 를 씀");
if (/<link\b/i.test(html) || /@import/i.test(html)) fails.push("외부 CSS · 글꼴(<link>, @import)을 씀");
if (/<img\b|<iframe\b/i.test(html)) fails.push("이미지 · iframe 을 씀");
if (/<svg\b/i.test(html)) fails.push("그림 부품(figure.fig) 밖에 svg 를 씀");
if (/\sstyle\s*=/.test(html)) fails.push('인라인 스타일(style="...")을 씀');
if (/[\u2014\u2013]/.test(html + svgTexts.join(" "))) fails.push("em dash · en dash 를 씀. 범위는 ~, 나열은 ' · '");
if (/\p{Extended_Pictographic}/u.test(textOf(html + svgTexts.join(" ")).replace(/[▼→↺①-⑳]/g, ""))) fails.push("이모지를 씀");

// 3. 남은 자리
const left = all(/\{\{[^}]*\}\}/g, html).map((m) => m[0]);
if (left.length) fails.push(`채우지 않은 자리 ${left.length}개: ${[...new Set(left)].slice(0, 5).join(", ")}`);

// 4. 클래스는 정해진 것만
const allowed = new Set(
  (
    "page meta summary note feature k result todo impl grp it chip what chip-legend wf fig scroll legend2 sw layer lt row steps box fn who down arrow loop " +
    "b-mine b-peer b-both b-past b-next c-entry c-config c-flow c-tool c-fn"
  ).split(/\s+/),
).add("");
const body = html.slice(html.indexOf("<body"));
const unknown = new Set();
for (const m of all(/class="([^"]*)"/g, body)) for (const c of m[1].split(/\s+/)) if (!allowed.has(c)) unknown.add(c);
if (unknown.size) fails.push(`명세에 없는 클래스: ${[...unknown].join(", ")}`);

// 5. 절 구성
const h2 = all(/<h2>([\s\S]*?)<\/h2>/g, body).map((m) => textOf(m[1]));
const wantH2 = ["1. 무엇을 만들었나", "2. 결과", "3. 주요 결정", "4. 검증 중 발견한 문제", "5. 남은 과제"];
if (JSON.stringify(h2) !== JSON.stringify(wantH2)) fails.push(`h2 절이 다름. 필요: ${wantH2.join(" / ")} · 지금: ${h2.join(" / ")}`);
const h3 = all(/<h3>([\s\S]*?)<\/h3>/g, body).map((m) => textOf(m[1]));
for (const want of ["1.1 만드는 제품", "1.2 전체 워크플로와 이번 작업의 위치", "1.3 만든 묶음"])
  if (!h3.includes(want)) fails.push(`소절 "${want}" 이 없음`);

// 6. 요약 상자
const summary = body.match(/<div class="summary">([\s\S]*?)<\/div>/);
if (!summary) fails.push("요약 상자(.summary)가 없음");
else {
  const lis = all(/<li>([\s\S]*?)<\/li>/g, summary[1]).map((m) => textOf(m[1]));
  if (lis.length !== 3) fails.push(`요약 상자 핵심 줄이 ${lis.length}개. 정확히 3개`);
  lis.filter((t) => t.length > 80).forEach((t) => warns.push(`요약 핵심 줄이 80자를 넘음: ${t.slice(0, 30)}…`));
}

// 7. 1.2 그림: figure.fig(diagram-design SVG) 또는 .wf 중 하나
const hasWf = /<div class="wf">/.test(body);
if (!hasWf && !figures.length) fails.push("1.2 그림(figure.fig 또는 .wf)이 없음");
if (figures.length + (hasWf ? 1 : 0) > 1) fails.push("1.2 그림이 둘 이상임. figure.fig 와 .wf 중 하나만 둔다");
const boxes = all(/<div class="box ([^"]+)">([\s\S]*?)<\/div>/g, body);
for (const [, cls, inner] of boxes) {
  if (!/\bb-(mine|peer|both|past|next)\b/.test(cls)) fails.push(`그림 칸에 색 클래스가 없음: ${textOf(inner).slice(0, 20)}`);
  const small = inner.match(/<small>([\s\S]*?)<\/small>/);
  if (small && textOf(small[1]).length > 35) warns.push(`칸 설명이 35자를 넘음: ${textOf(small[1]).slice(0, 35)}…`);
  const name = inner.match(/<b>([\s\S]*?)<\/b>/);
  if (name && textOf(name[1]).replace(/^[①-⑳]\s*/, "").length > 14) warns.push(`칸 이름이 14자를 넘음: ${textOf(name[1])}`);
  if (/\bb-both\b/.test(cls) && !/class="who"/.test(inner)) fails.push(`함께(b-both) 칸에 누가 무엇을 했는지(.who)가 없음: ${textOf(inner).slice(0, 20)}`);
}
const used = figures.length ? figUsed : new Set(boxes.map(([, cls]) => cls.match(/b-(mine|peer|both|past|next)/)?.[0]).filter(Boolean));
const legend = new Set(all(/class="sw (b-[a-z]+)"/g, body).map((m) => m[1]));
if (figures.length && !legend.size) fails.push("그림(figure.fig)에 범례(.legend2)가 없음");
for (const c of used) if (!legend.has(c)) fails.push(`그림에 쓴 색 ${c} 이 범례에 없음`);
for (const c of legend) if (!used.has(c)) fails.push(`범례의 색 ${c} 을 그림에서 쓰지 않음`);

// 8. 기능 묶음과 구현 칩
const order = ["c-entry", "c-config", "c-flow", "c-tool", "c-fn"];
const features = all(/<div class="feature">([\s\S]*?)<\/table>\s*<\/div>/g, body);
if (!features.length) fails.push("기능 묶음(.feature)이 없음");
features.forEach(([, f], i) => {
  const keys = all(/<td class="k">([\s\S]*?)<\/td>/g, f).map((m) => textOf(m[1]));
  if (JSON.stringify(keys) !== JSON.stringify(["역할", "동작", "특징", "구현"])) fails.push(`기능 묶음 ${i + 1}의 줄 이름이 역할 · 동작 · 특징 · 구현이 아님: ${keys.join(" · ")}`);
  const items = all(/<div class="it"><span class="chip (c-[a-z]+)">([\s\S]*?)<\/span>(<span class="what">([\s\S]*?)<\/span>)?<\/div>/g, f);
  const chips = all(/class="chip /g, f).length;
  if (items.length !== chips) fails.push(`기능 묶음 ${i + 1}: 칩은 한 줄(.it)에 칩 하나 + 설명(.what) 하나여야 함`);
  if (items.length && (items.length < 3 || items.length > 10)) warns.push(`기능 묶음 ${i + 1}의 칩이 ${items.length}개. 3~10개 권장`);
  let last = -1;
  for (const [, kind, name, , what] of items) {
    if (!what) fails.push(`칩 ${textOf(name)} 에 설명(.what)이 없음`);
    else if (textOf(what).length > 30) warns.push(`칩 설명이 30자를 넘음: ${textOf(what)}`);
    if (/\(.*\)/.test(textOf(name))) fails.push(`칩 이름에 괄호 · 인자를 붙임: ${textOf(name)}`);
    const k = order.indexOf(kind);
    if (k < last) fails.push(`기능 묶음 ${i + 1}의 칩 순서가 종류 순서(${order.join(" → ")})가 아님: ${textOf(name)}`);
    last = Math.max(last, k);
  }
});
const chipKinds = new Set(all(/class="chip (c-[a-z]+)"/g, body.replace(/<div class="chip-legend">[\s\S]*?<\/div>/, "")).map((m) => m[1]));
const legendKinds = new Set(all(/class="chip (c-[a-z]+)"/g, (body.match(/<div class="chip-legend">([\s\S]*?)<\/div>/) || ["", ""])[1]).map((m) => m[1]));
if (chipKinds.size && !legendKinds.size) fails.push("칩 범례(.chip-legend)가 없음");
for (const c of chipKinds) if (legendKinds.size && !legendKinds.has(c)) fails.push(`칩 종류 ${c} 가 범례에 없음`);
for (const c of legendKinds) if (!chipKinds.has(c)) fails.push(`범례의 칩 종류 ${c} 를 쓰지 않음`);

// 9. 문체 (경고)
const sentences = textOf(body.replace(/<figure class="fig">[\s\S]*?<\/figure>/g, " ").replace(/<table[\s\S]*?<\/table>/g, " ").replace(/<div class="wf">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, " "))
  .split(/(?<=[.?!])\s+/)
  .filter((t) => /[가-힣]/.test(t));
const da = sentences.filter((t) => /(다|요)\.$/.test(t));
if (da.length) warns.push(`"~다." · "~요."로 끝나는 문장 ${da.length}개(명사형 어미 권장): ${da.slice(0, 2).map((t) => t.slice(-20)).join(" / ")}`);
const testCount = textOf(body).match(/\d+\s*(passed|개 통과|건 통과)/);
if (testCount) warns.push(`테스트 개수가 본문에 있음: "${testCount[0]}". 눈에 띄지 않게 note 한 줄로만`);

for (const f of fails) console.log(`실패: ${f}`);
for (const w of warns) console.log(`경고: ${w}`);
console.log(fails.length ? `\n실패 ${fails.length} · 경고 ${warns.length}` : `\n통과 (경고 ${warns.length})`);
process.exit(fails.length ? 1 : 0);
