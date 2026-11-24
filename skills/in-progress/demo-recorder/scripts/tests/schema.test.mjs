import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, subst, parseTarget, defaultHold } from "../recorder/schema.mjs";

const base = (steps) => ({ name: "t", steps });

test("valid scenario fills defaults", () => {
  const { scenario, errors } = normalize(base([{ page: "a", goto: "https://x", caption: "가나다" }, { scroll: { by: 100 } }]));
  assert.deepEqual(errors, []);
  assert.equal(scenario.viewport.width, 1920);
  assert.equal(scenario.steps[1].page, "a");
  assert.equal(scenario.steps[0].hold, 2800);
  assert.equal(scenario.steps[1].id, "s2");
});

test("three kinds of errors are reported", () => {
  const { errors } = normalize(base([
    { id: "a", page: "p", goto: "x", bogus: 1 },
    { id: "a", caption: "① 여기" },
  ]));
  assert.ok(errors.some((e) => e.includes("알 수 없는 키 bogus")));
  assert.ok(errors.some((e) => e.includes("id 중복")));
  assert.ok(errors.some((e) => e.includes("자막 번호")));
});

test("two actions in one step is an error", () => {
  const { errors } = normalize(base([{ page: "p", goto: "x", click: "a" }]));
  assert.ok(errors.some((e) => e.includes("동작은 하나만")));
});

test("caption numbers must match box numbers", () => {
  const ok = normalize(base([{ page: "p", caption: "① ②", highlight: [{ target: "a", n: 1 }, { target: "b", n: 2 }] }]));
  assert.deepEqual(ok.errors, []);
});

test("click.opens renames the page for following steps", () => {
  const { scenario } = normalize(base([{ page: "a", click: { target: "x", opens: "b" } }, { scroll: { by: 1 } }]));
  assert.equal(scenario.steps[0].page, "a");
  assert.equal(scenario.steps[1].page, "b");
});

test("wait.edit must be keep|cut|{speed}", () => {
  const { errors } = normalize(base([{ page: "p", wait: { ms: 1000, edit: "fast" } }]));
  assert.ok(errors.some((e) => e.includes("wait.edit")));
});

test("subst, parseTarget, defaultHold", () => {
  assert.equal(subst("a/${k}/${z}", { k: "X" }), "a/X/${z}");
  assert.deepEqual(subst({ u: ["${k}"] }, { k: 1 }), { u: ["1"] });
  assert.deepEqual(parseTarget("text=hi"), { css: null, text: "hi" });
  assert.deepEqual(parseTarget({ css: "a", text: "b" }), { css: "a", text: "b" });
  assert.deepEqual(parseTarget("button.x"), { css: "button.x", text: null });
  assert.equal(defaultHold("가".repeat(30)), 4300);
  assert.equal(defaultHold(""), 1500);
});
