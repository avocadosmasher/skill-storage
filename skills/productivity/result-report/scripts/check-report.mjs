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

const html = readFileSync(target, "utf8");
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

// 1. CSS 는 틀 그대로
const style = styleOf(html);
if (style === null) fails.push("<style> 블록이 없음");
else if (style !== styleOf(template)) fails.push("<style> 블록이 틀(assets/result-report.html)과 다름. CSS 는 고치지 않는다");
if (all(/<style/g, html).length > 1) fails.push("<style> 블록이 둘 이상임");

// 2. 금지 요소
if (/<script/i.test(html)) fails.push("<script> 를 씀");
if (/<link\b/i.test(html) || /@import/i.test(html)) fails.push("외부 CSS · 글꼴(<link>, @import)을 씀");
if (/<img\b|<svg\b|<iframe\b/i.test(html)) fails.push("이미지 · svg · iframe 을 씀");
if (/\sstyle\s*=/.test(html)) fails.push('인라인 스타일(style="...")을 씀');
if (/[\u2014\u2013]/.test(html)) fails.push("em dash · en dash 를 씀. 범위는 ~, 나열은 ' · '");
if (/\p{Extended_Pictographic}/u.test(textOf(html).replace(/[▼→↺①-⑳]/g, ""))) fails.push("이모지를 씀");

// 3. 남은 자리
const left = all(/\{\{[^}]*\}\}/g, html).map((m) => m[0]);
if (left.length) fails.push(`채우지 않은 자리 ${left.length}개: ${[...new Set(left)].slice(0, 5).join(", ")}`);

// 4. 클래스는 정해진 것만
const allowed = new Set(
  (
    "page meta summary note feature k result todo impl grp it chip what chip-legend wf legend2 sw layer lt row steps box fn who down arrow loop " +
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

// 7. 흐름 그림
if (!/<div class="wf">/.test(body)) fails.push("흐름 그림(.wf)이 없음");
const boxes = all(/<div class="box ([^"]+)">([\s\S]*?)<\/div>/g, body);
for (const [, cls, inner] of boxes) {
  if (!/\bb-(mine|peer|both|past|next)\b/.test(cls)) fails.push(`그림 칸에 색 클래스가 없음: ${textOf(inner).slice(0, 20)}`);
  const small = inner.match(/<small>([\s\S]*?)<\/small>/);
  if (small && textOf(small[1]).length > 35) warns.push(`칸 설명이 35자를 넘음: ${textOf(small[1]).slice(0, 35)}…`);
  const name = inner.match(/<b>([\s\S]*?)<\/b>/);
  if (name && textOf(name[1]).replace(/^[①-⑳]\s*/, "").length > 14) warns.push(`칸 이름이 14자를 넘음: ${textOf(name[1])}`);
  if (/\bb-both\b/.test(cls) && !/class="who"/.test(inner)) fails.push(`함께(b-both) 칸에 누가 무엇을 했는지(.who)가 없음: ${textOf(inner).slice(0, 20)}`);
}
const used = new Set(boxes.map(([, cls]) => cls.match(/b-(mine|peer|both|past|next)/)?.[0]).filter(Boolean));
const legend = new Set(all(/class="sw (b-[a-z]+)"/g, body).map((m) => m[1]));
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
const sentences = textOf(body.replace(/<table[\s\S]*?<\/table>/g, " ").replace(/<div class="wf">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, " "))
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
