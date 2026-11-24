// Step runner. Runs inside `ego-browser nodejs`; ego globals are passed in as `g`.
import { normalize, subst, parseTarget } from "./schema.mjs";
import { KIT_SRC } from "./pagekit.mjs";
import { Capture } from "./capture.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run({ g, scenarioPath, outDir, mode = "record", spaceId = null, vars = {}, from = null }) {
  const fs = await import("node:fs/promises");
  const { pathToFileURL } = await import("node:url");
  const mod = await import(pathToFileURL(scenarioPath).href + `?t=${Date.now()}`);
  const { scenario: sc, errors, warnings } = normalize(mod.default, vars);
  if (errors.length) throw new Error("시나리오 오류:\n" + errors.join("\n"));
  for (const w of warnings) console.log("경고:", w);

  const dry = mode === "dry";
  const framesDir = `${outDir}/frames`;
  await fs.mkdir(framesDir, { recursive: true });
  const t0 = Date.now();
  const cap = new Capture({ fs, framesDir, t0 });
  const now = () => Date.now() - t0;
  const V = { ...sc.vars };
  // variables referenced by redaction rules hold real names/emails: never write them to disk (#review-1)
  const secret = new Set([...JSON.stringify(sc.redact).matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]));
  const masked = (vars) => Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, secret.has(k) ? "***" : v]));
  const timeline = {
    version: 1, mode, scenario: { ...sc, vars: masked(sc.vars) }, viewport: sc.viewport, from, startedAt: new Date(t0).toISOString(),
    frames: cap.frames, steps: [], switches: [], captureErrors: cap.errors, status: "running",
  };

  // ---- task space ----
  let task;
  if (spaceId != null) {
    const entry = (await g.listTaskSpaces()).find((s) => s.id === spaceId);
    if (!entry) throw new Error(`task space ${spaceId} 없음`);
    task = entry.ownership === "user" ? await g.claimTaskSpace(spaceId)
      : entry.ownership === "agentDelegatedToUser" ? await g.takeOverTaskSpace(spaceId)
      : await g.taskSpace(spaceId);
  } else {
    task = await g.taskSpace(`demo-recorder ${sc.name} ${new Date(t0).toISOString().slice(0, 16)}`);
  }
  timeline.spaceId = task.spaceId;
  if (!String(task.name || "").startsWith("demo-recorder")) {
    throw new Error(`task space ${task.spaceId}("${task.name}")는 demo-recorder가 만든 공간이 아닙니다. 사용자 탭을 닫지 않도록 --space 없이 실행하세요`);
  }
  // leftovers from an earlier run in the same space (popups, extra tabs): keep only the first page
  for (const extra of (await task.pages()).slice(1)) await extra.close().catch(() => {});
  console.log(`task space: ${task.spaceId}`);

  // ---- pages ----
  const pages = new Map(); // name -> ego page
  let firstUsed = false;
  const dr = async (p, name, ...args) =>
    p.evaluate(`(() => { ${KIT_SRC}; return window.__dr[${JSON.stringify(name)}](...${JSON.stringify(args)}); })()`);
  const prep = async (p) => {
    const v = sc.viewport;
    await p.cdp("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, deviceScaleFactor: v.dpr, mobile: false });
  };
  const getPage = async (name) => {
    if (pages.has(name)) return pages.get(name);
    let p;
    if (!firstUsed) {
      firstUsed = true;
      p = (await task.pages())[0];
      if (!p) {
        const tabs = await task.tabs();
        p = tabs.length ? await task.adopt(tabs[0].page) : await task.newPage();
      }
    } else {
      p = await task.newPage();
    }
    await prep(p);
    pages.set(name, p);
    return p;
  };

  const redactCheck = async (p) => {
    if (!sc.redact.length) return [];
    const url = await p.url();
    const all = subst(sc.redact, V);
    const unresolved = all.filter((r) => /\$\{\w+\}/.test(`${r.text || ""}${r.selector || ""}`));
    if (unresolved.length) throw new Error(`가리기 규칙의 변수가 비어 있습니다 (--var로 넘기세요): ${unresolved.map((r) => r.text || r.selector).join(", ")}`);
    const rules = all.filter((r) => new RegExp(r.url).test(url));
    if (!rules.length) {
      await dr(p, "unredact").catch(() => {});
      return [];
    }
    const deadline = Date.now() + 10000;
    for (;;) {
      const counts = await dr(p, "redact", rules);
      const missing = rules.filter((r, i) => r.required && counts[i] === 0);
      if (!missing.length) return counts;
      if (Date.now() > deadline) {
        throw new Error(`가리기 대상이 화면에 없습니다 (${url}): ${missing.map((r) => r.selector || "text 규칙").join(", ")}`);
      }
      await sleep(300);
    }
  };

  const waitFor = async (p, cond, timeout = 10000, reloadEvery = 0) => {
    const deadline = Date.now() + timeout;
    let lastReload = Date.now();
    for (;;) {
      let ok = false;
      try {
        if (cond.url) ok = new RegExp(cond.url).test(await p.url());
        if (cond.text && (ok || !cond.url)) ok = await dr(p, "hasText", cond.text);
        if (cond.selector && (ok || (!cond.url && !cond.text))) ok = (await dr(p, "count", { css: cond.selector })) > 0;
        if (cond.js && (ok || (!cond.url && !cond.text && !cond.selector))) ok = !!(await p.evaluate(`(() => (${cond.js}))()`));
      } catch {
        ok = false; // page mid-navigation
      }
      if (ok) return;
      if (Date.now() > deadline) throw new Error(`기대 화면이 ${timeout}ms 안에 나오지 않았습니다: ${JSON.stringify(cond)}`);
      if (reloadEvery && Date.now() - lastReload > reloadEvery) {
        lastReload = Date.now();
        cap.blind = true;
        await p.reload({ timeout: 30000 }).catch(() => {});
        await prep(p);
        await redactCheck(p);
        cap.blind = false;
      }
      await sleep(250);
    }
  };

  const waitScroll = async (p, res) => {
    if (res?.error) throw new Error(res.error);
    const deadline = Date.now() + (res?.dur || 0) + 4000;
    await sleep(Math.max(0, (res?.dur || 0) - 50));
    while (!(await dr(p, "scrollDone"))) {
      if (Date.now() > deadline) break;
      await sleep(60);
    }
  };

  const measure = async (p, highlight) => {
    const out = [];
    for (const h of highlight) {
      const t = parseTarget(h.target);
      const rects = await dr(p, "rects", t, !!h.all, h.limit || 50);
      if (!rects.length) console.log(`경고: 상자 대상이 화면에 없음 ${JSON.stringify(h.target)}`);
      if (rects.some((r) => r.covered)) console.log(`경고: 상자 대상이 다른 요소에 가려짐 ${JSON.stringify(h.target)} (align을 키우세요)`);
      rects.forEach((rect, k) => out.push({ n: k === 0 ? h.n || null : null, color: h.color || null, rect }));
    }
    return out;
  };

  let cur = null;
  let lastCursor = null;
  const steps = timeline.steps;
  try {
    // first page + redaction before any frame is taken
    cap.blind = true;
    if (from && !sc.steps.some((s) => s.id === from)) throw new Error(`--from ${from}: 그런 단계가 없습니다`);
    if (!dry) {
      // test shot before anything sensitive is on screen: a hidden/minimised window fails here, not mid-run (#review-15)
      const p0 = await getPage((sc.steps.find((s) => s.id === from) || sc.steps[0]).page);
      await p0.cdp("Page.bringToFront");
      try {
        await p0.cdp("Page.captureScreenshot", { format: "jpeg", quality: 30 }, { timeout: 5000 });
      } catch {
        throw new Error("시험 캡처가 실패했습니다. ego 창을 화면 앞에 두고 가리거나 최소화하지 마세요");
      }
      cap.start();
    }
    let started = !from;

    for (const raw of sc.steps) {
      if (cap.fatal) throw cap.fatal;
      if (!started && raw.id === from) started = true;
      if (!started) continue;
      if (dry && raw.dryRun === "skip") {
        steps.push({ id: raw.id, scene: raw.scene, page: raw.page, status: "skipped", t0: now(), t1: now() });
        continue;
      }
      // ${since:<step id>}: time since that step started, e.g. "1분 10초" (rounded to 5 s)
      for (const done of steps) {
        if (done.t0 == null || done.status === "skipped") continue;
        const sec = Math.round((now() - done.t0) / 5000) * 5;
        V[`since:${done.id}`] = sec >= 60 ? `${Math.floor(sec / 60)}분${sec % 60 ? ` ${sec % 60}초` : ""}` : `${sec}초`;
      }
      const s = subst(raw, V);
      const emptyText = (o) => o && typeof o === "object" && Object.entries(o).some(([k, v]) => (k === "text" && v === "") || emptyText(v));
      if (emptyText(s)) throw new Error(`단계 ${s.id}: 변수를 넣은 뒤 text가 빈 글자입니다 (--var 확인)`);
      const rec = { id: s.id, scene: s.scene, page: s.page, caption: s.caption || "", t0: now(), status: "running", cursor: [], highlights: [] };
      if (s.bridge) rec.bridge = s.bridge;
      if (s.sweep) rec.sweep = s.sweep;
      steps.push(rec);

      if (!cur || cur.name !== s.page) {
        cap.blind = true; // no frames of the old tab under the new step's caption
        const p = await getPage(s.page);
        await p.cdp("Page.bringToFront");
        cur = { name: s.page, page: p };
        cap.page = cur;
        timeline.switches.push({ t: now(), page: s.page });
        if (!s.goto) {
          await redactCheck(p);
          cap.blind = false;
        }
      }
      const p = cur.page;

      // ---- action ----
      if (s.goto) {
        cap.blind = true;
        await p.goto(s.goto, { timeout: 45000 });
        await prep(p);
      } else if (s.click) {
        const c = typeof s.click === "string" || s.click.css || s.click.text ? { target: s.click } : s.click;
        const t = parseTarget(c.target);
        const key = `c${s.id}`;
        if (!(await dr(p, "mark", t, key))) throw new Error(`누를 대상을 찾지 못함: ${JSON.stringify(c.target)}`);
        let [r] = await dr(p, "rects", { css: `[data-dr-mark="${key}"]` }, false, 1);
        if (!r) {
          await waitScroll(p, await dr(p, "scrollTo", { css: `[data-dr-mark="${key}"]` }, 0.4, 900));
          [r] = await dr(p, "rects", { css: `[data-dr-mark="${key}"]` }, false, 1);
        }
        if (r) {
          const x = r.x + r.w / 2, y = r.y + r.h / 2;
          rec.cursor.push({ t: now(), x, y, type: "move", from: lastCursor });
          lastCursor = { x, y };
          if (!dry) await sleep(550);
        }
        let popup;
        if (c.opens) popup = p.waitForEvent("popup", { timeout: 8000 }).catch(() => null);
        if (c.navigates || c.opens || s.expect?.url) cap.blind = true; // a click that changes document: no frames until redacted
        rec.cursor.push({ t: now(), ...(lastCursor || { x: 0, y: 0 }), type: "click" });
        const receipt = await p.click(`[data-dr-mark="${key}"]`, { label: "demo click" });
        if (c.opens) {
          let np = receipt?.popups?.length ? task.page(receipt.popups[0].label) : await popup;
          if (!np) np = p; // opened in the same tab after all
          await np.waitForLoadState().catch(() => {});
          await prep(np);
          await np.cdp("Page.bringToFront");
          pages.set(c.opens, np);
          rec.page = c.opens;
          cur = { name: c.opens, page: np };
          cap.blind = true;
          cap.page = cur;
          timeline.switches.push({ t: now(), page: c.opens });
        }
      } else if (s.fill) {
        const t = parseTarget(s.fill.target);
        const key = `f${s.id}`;
        if (!(await dr(p, "mark", t, key))) throw new Error(`입력 칸을 찾지 못함: ${JSON.stringify(s.fill.target)}`);
        await p.fill(`[data-dr-mark="${key}"]`, s.fill.value);
      } else if (s.paste) {
        const t = parseTarget(s.paste.target);
        const key = `f${s.id}`;
        if (!(await dr(p, "mark", t, key))) throw new Error(`입력 칸을 찾지 못함: ${JSON.stringify(s.paste.target)}`);
        await p.click(`[data-dr-mark="${key}"]`, { label: "focus field" });
        await p.keyboard.paste(s.paste.value);
      } else if (s.type) {
        // click a field (e.g. a combobox), type like a person, optionally press a key
        const t = parseTarget(s.type.target);
        const key = `f${s.id}`;
        if (!(await dr(p, "mark", t, key))) throw new Error(`입력 칸을 찾지 못함: ${JSON.stringify(s.type.target)}`);
        await p.click(`[data-dr-mark="${key}"]`, { label: "focus field" });
        await p.keyboard.type(s.type.value, { delay: dry ? 0 : 60 });
        if (s.type.then) { await sleep(dry ? 300 : 800); await p.keyboard.press(s.type.then); }
      } else if (s.press) {
        await p.keyboard.press(s.press);
      } else if (s.select) {
        const t = parseTarget(s.select.target);
        const key = `f${s.id}`;
        if (!(await dr(p, "mark", t, key))) throw new Error(`목록을 찾지 못함: ${JSON.stringify(s.select.target)}`);
        await p.selectOption(`[data-dr-mark="${key}"]`, s.select.value);
      } else if (s.scroll) {
        const sp = s.scroll.speed || 500;
        if (s.scroll.to) {
          // lazy-loaded targets: step down until the target exists (up to s.scroll.search px, default 6000)
          const tgt = parseTarget(s.scroll.to);
          let searched = 0;
          const limit = s.scroll.search ?? 6000;
          while ((await dr(p, "count", tgt)) === 0) {
            if (searched >= limit) throw new Error(`스크롤 대상을 찾지 못함: ${JSON.stringify(s.scroll.to)}`);
            await waitScroll(p, await dr(p, "scrollBy", 500, sp * 2, s.scroll.scroller || null, null));
            searched += 500;
            await sleep(400);
          }
          await waitScroll(p, await dr(p, "scrollTo", tgt, s.scroll.align ?? 0.25, sp, s.scroll.scroller || null));
        } else {
          await waitScroll(p, await dr(p, "scrollBy", s.scroll.by, sp, s.scroll.scroller || null, s.scroll.near ? parseTarget(s.scroll.near) : null));
        }
      } else if (s.wait) {
        const w = s.wait;
        const ws = now();
        if (w.ms) await sleep(dry ? 300 : w.ms);
        if (w.until) await waitFor(p, w.until, w.timeout || 180000, w.reloadEvery || 0);
        rec.wait = { t0: ws, t1: now(), edit: w.edit ?? "keep", keep: w.keep || [1000, 1000] };
      }

      const pa = cur.page; // the action may have switched to a popup
      if (s.expect) await waitFor(pa, s.expect, s.expect.timeout || 10000);
      await redactCheck(pa);
      if (cap.blind) {
        cap.blind = false;
        if (!dry) await sleep(150);
      }
      if (!dry) await sleep(300);
      rec.tSettle = now();

      if (s.capture) {
        const c = s.capture;
        // fetch: read through the site's API from an open tab of that site (GET with the logged-in session), no tab switch on screen
        let src;
        if (c.fetch) {
          const origin = new URL(c.fetch).origin;
          let fp = null;
          for (const q of pages.values()) if ((await q.url().catch(() => "")).startsWith(origin)) { fp = q; break; }
          if (fp) {
            src = String((await fp.fetch(c.fetch, { timeout: 15000 })).body);
          } else {
            // no tab on that site (e.g. --from): read from a short-lived tab, capture paused meanwhile
            cap.blind = true;
            const tmp = await task.newPage();
            try {
              await tmp.goto(origin + "/", { timeout: 45000 });
              src = String((await tmp.fetch(c.fetch, { timeout: 15000 })).body);
            } finally {
              await tmp.close().catch(() => {});
              await pa.cdp("Page.bringToFront");
              await sleep(300);
              cap.blind = false;
            }
          }
        } else src = c.from === "url" ? await pa.url() : await pa.evaluate(
          `(() => { ${KIT_SRC}; const t = ${JSON.stringify(parseTarget(c.from))}; const el = document.querySelector(t.css || "body"); return el ? el.textContent : ""; })()`,
        );
        const m = new RegExp(c.match).exec(src);
        if (!m) throw new Error(`값을 읽지 못함 (${c.var}): ${c.match}`);
        V[c.var] = m[1] ?? m[0];
        rec.captured = { [c.var]: String(V[c.var]).slice(0, 120) };
        console.log(`변수 ${c.var} = ${V[c.var]}`);
      }

      rec.highlights = await measure(pa, s.highlight);
      if (dry) {
        const shot = await cap.shot(pa);
        await cap.saveFrame(cur.name, shot.data, now());
        await sleep(300);
      } else {
        await sleep(s.hold);
      }
      const after = await measure(pa, s.highlight);
      rec.highlights.forEach((h, k) => {
        const a = after[k];
        h.rectEnd = a ? a.rect : null;
        h.moved = !a || Math.abs(a.rect.x - h.rect.x) > 2 || Math.abs(a.rect.y - h.rect.y) > 2;
      });
      rec.t1 = now();
      rec.status = "ok";
      console.log(`단계 ${rec.id} ok (${((rec.t1 - rec.t0) / 1000).toFixed(1)}s)`);
    }
    timeline.status = "ok";
  } catch (err) {
    timeline.status = "failed";
    timeline.error = String(err?.stack || err);
    const last = steps.at(-1);
    if (last && last.status === "running") { last.status = "failed"; last.error = String(err); last.t1 = now(); }
    console.log("실패:", String(err));
    try {
      await fs.mkdir(`${outDir}/fail`, { recursive: true });
      if (cur) {
        await fs.writeFile(`${outDir}/fail/url.txt`, await cur.page.url());
        const shot = await cap.shot(cur.page).catch(() => null);
        if (shot) await fs.writeFile(`${outDir}/fail/screen.jpg`, Buffer.from(shot.data, "base64"));
        await fs.writeFile(`${outDir}/fail/snapshot.txt`, String(await cur.page.snapshot().catch((e) => e)));
      }
    } catch (e2) {
      console.log("실패 기록 중 오류:", String(e2));
    }
  } finally {
    if (!dry) await cap.stop();
    timeline.tEnd = now();
    for (const p of pages.values()) {
      await p.cdp("Emulation.clearDeviceMetricsOverride").catch(() => {});
      await dr(p, "unredact").catch(() => {});
    }
    timeline.vars = masked(V);
    await fs.writeFile(`${outDir}/timeline.json`, JSON.stringify(timeline, null, 1));
  }

  const ok = cap.frames.slice(1).map((f, i) => f.t - cap.frames[i].t).sort((a, b) => a - b);
  const summary = {
    status: timeline.status, spaceId: task.spaceId, frames: cap.frames.length,
    seconds: +(timeline.tEnd / 1000).toFixed(1),
    fps: +(cap.frames.length / Math.max(1, timeline.tEnd / 1000)).toFixed(1),
    gapMax: ok.at(-1) ?? null, gapMedian: ok[ok.length >> 1] ?? null, captureErrors: cap.errors.length,
    steps: steps.map((s) => `${s.id}:${s.status}`).join(" "),
    outDir,
  };
  console.log("DR_RESULT " + JSON.stringify(summary));
  if (timeline.status !== "ok") throw new Error(timeline.error.split("\n")[0]);
  return summary;
}
