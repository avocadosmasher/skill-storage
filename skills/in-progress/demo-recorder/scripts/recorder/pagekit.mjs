// In-page helpers. KIT_SRC is evaluated inside the page and defines window.__dr once per document.
// Everything inside the template runs in the browser, not in Node.

export const KIT_SRC = `(() => {
if (window.__dr && window.__dr.v === 7) return true;
const norm = (s) => (s || "").replace(/\\s+/g, " ").trim();
const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const find = (t, all) => {
  let cands;
  if (t.css) cands = [...document.querySelectorAll(t.css)];
  else cands = [...document.body.querySelectorAll("*")];
  if (t.re) {
    const re = new RegExp(t.re);
    cands = cands.filter((el) => re.test(norm(el.textContent)) && ![...el.children].some((c) => re.test(norm(c.textContent))));
  }
  if (t.text) {
    const want = norm(t.text);
    cands = cands.filter((el) => norm(el.textContent).includes(want));
    if (!t.css) cands = cands.filter((el) => ![...el.children].some((c) => norm(c.textContent).includes(want)));
  }
  cands = cands.filter((el) => !["SCRIPT", "STYLE", "HEAD", "TITLE"].includes(el.tagName));
  if (t.text) {
    // prefer exact text, then text starting with the target, then the shortest text (document order breaks ties)
    const want = norm(t.text);
    const rank = (el) => { const x = norm(el.textContent); return x === want ? 0 : x.startsWith(want) ? 1 : 2; };
    cands = cands.map((el, i) => ({ el, i, r: rank(el), n: norm(el.textContent).length }))
      .sort((a, b) => a.r - b.r || (a.r === 2 ? a.n - b.n : 0) || a.i - b.i).map((x) => x.el);
  }
  const vis = cands.filter(visible);
  const list = vis.length ? vis : cands;
  return all ? list : list.slice(0, 1);
};
const scrollerOf = (el, sel) => {
  if (sel) return document.querySelector(sel);
  let s = el && el.parentElement;
  while (s && s !== document.body && s !== document.documentElement) {
    const oy = getComputedStyle(s).overflowY;
    if (/(auto|scroll|overlay)/.test(oy) && s.scrollHeight > s.clientHeight + 4) return s;
    s = s.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};
const viewTop = (sc) => (sc === document.scrollingElement || sc === document.documentElement ? 0 : sc.getBoundingClientRect().top);
const viewH = (sc) => (sc === document.scrollingElement || sc === document.documentElement ? innerHeight : sc.clientHeight);
const animate = (sc, to, speed) => {
  const from = sc.scrollTop;
  const max = sc.scrollHeight - sc.clientHeight;
  to = Math.max(0, Math.min(max, to));
  const dist = Math.abs(to - from);
  const dur = dist < 2 ? 0 : Math.max(350, (dist / (speed || 500)) * 1000);
  window.__drScrollDone = dur === 0;
  if (dur === 0) return { from, to, dur };
  const t0 = performance.now();
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    sc.scrollTop = from + (to - from) * ease(p);
    if (p < 1) requestAnimationFrame(tick); else window.__drScrollDone = true;
  };
  requestAnimationFrame(tick);
  return { from, to, dur };
};
window.__dr = {
  v: 7,
  count: (t) => find(t, true).length,
  rects: (t, all, limit) => {
    const els = find(t, !!all);
    return els.map((el) => {
      const r = el.getBoundingClientRect();
      const cx = Math.min(innerWidth - 1, Math.max(0, r.x + Math.min(r.width / 2, 20))), cy = Math.min(innerHeight - 1, Math.max(0, r.y + r.height / 2));
      const top = document.elementFromPoint(cx, cy);
      const covered = !!top && !el.contains(top) && !top.contains(el);
      return { x: r.x, y: r.y, w: r.width, h: r.height, covered };
    })
      .filter((r) => r.w > 0 && r.h > 0 && r.y + r.h > 0 && r.y < innerHeight && r.x + r.w > 0 && r.x < innerWidth)
      .slice(0, limit || 50);
  },
  mark: (t, key) => {
    const el = find(t, false)[0];
    if (!el) return false;
    document.querySelectorAll('[data-dr-mark="' + key + '"]').forEach((e) => e.removeAttribute("data-dr-mark"));
    el.setAttribute("data-dr-mark", key);
    return true;
  },
  scrollTo: (t, align, speed, scSel) => {
    const el = find(t, false)[0];
    if (!el) return { error: "대상을 찾지 못함" };
    const sc = scrollerOf(el, scSel);
    const r = el.getBoundingClientRect();
    const to = sc.scrollTop + (r.top - viewTop(sc)) - viewH(sc) * (align ?? 0.25);
    return animate(sc, to, speed);
  },
  scrollBy: (px, speed, scSel, nearT) => {
    const near = nearT ? find(nearT, false)[0] : null;
    let sc = scSel ? document.querySelector(scSel) : null;
    if (!sc && near) sc = scrollerOf(near);
    if (!sc) {
      // largest scrollable element on screen
      const all = [...document.querySelectorAll("*")].filter((e) => /(auto|scroll|overlay)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4);
      all.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth);
      const doc = document.scrollingElement;
      sc = doc.scrollHeight > doc.clientHeight + 4 ? doc : all[0] || doc;
    }
    return animate(sc, sc.scrollTop + px, speed);
  },
  scrollDone: () => window.__drScrollDone !== false,
  hasText: (s) => norm(document.body && document.body.innerText).includes(norm(s)),
  redact: (rules) => {
    let st = document.getElementById("dr-redact-style");
    if (!st) { st = document.createElement("style"); st.id = "dr-redact-style"; (document.head || document.documentElement).appendChild(st); }
    const css = rules.filter((r) => r.selector).map((r) => r.selector + "{filter:blur(" + (r.px || 10) + "px)!important}");
    st.textContent = css.join("\\n") + "\\n.dr-redact-t{filter:blur(10px)!important}";
    const applyText = () => {
      for (const r of rules.filter((r) => r.text || r.pattern)) for (const el of find(r.text ? { text: r.text } : { re: r.pattern }, true)) el.classList.add("dr-redact-t");
    };
    applyText();
    window.__drRedactRules = rules;
    if (!window.__drRedactObs && rules.some((r) => r.text || r.pattern)) {
      let pending = false;
      window.__drRedactObs = new MutationObserver(() => {
        if (pending) return; pending = true;
        requestAnimationFrame(() => { pending = false; for (const r of (window.__drRedactRules || []).filter((r) => r.text || r.pattern)) for (const el of find(r.text ? { text: r.text } : { re: r.pattern }, true)) el.classList.add("dr-redact-t"); });
      });
      window.__drRedactObs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    }
    return rules.map((r) => (r.selector ? document.querySelectorAll(r.selector).length : find(r.text ? { text: r.text } : { re: r.pattern }, true).length));
  },
  unredact: () => {
    document.getElementById("dr-redact-style")?.remove();
    document.querySelectorAll(".dr-redact-t").forEach((e) => e.classList.remove("dr-redact-t"));
    window.__drRedactObs?.disconnect(); window.__drRedactObs = null; window.__drRedactRules = [];
  },
};
return true;
})()`;
