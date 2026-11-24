"""demo-recorder editor.

uv run --no-project --with imageio-ffmpeg --with pillow python dr_edit.py preview <out_dir>
uv run --no-project --with imageio-ffmpeg --with pillow python dr_edit.py render <out_dir> [--no-burn] [--scale 0.667]
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from draw import draw_card, draw_overlay, draw_sweep, font  # noqa: E402
from timemap import TimeMap, frame_at  # noqa: E402

MOVE_MS = 450
RIPPLE_MS = 450


class Project:
    def __init__(self, out_dir: Path, wait_edit=None, keep_gaps: bool = False):
        self.dir = out_dir
        self.tl = json.loads((out_dir / "timeline.json").read_text(encoding="utf-8"))
        self.frames = self.tl["frames"]
        if not self.frames:
            raise SystemExit("프레임이 없습니다")
        self.times = [f["t"] for f in self.frames]
        self.steps = [s for s in self.tl["steps"] if s.get("status") in ("ok", "failed") and "t0" in s]
        self.vp = self.tl["viewport"]
        with Image.open(self.frame_path(0)) as im:
            self.src_size = im.size
        self.k = self.src_size[0] / self.vp["width"]  # CSS px -> frame px
        waits = [s["wait"] for s in self.steps if s.get("wait")]
        if wait_edit:
            waits = [{**w, "edit": wait_edit} for w in waits]
        # frozen stretches while pages load (no frames by design): keep 0.5 s of each (#review-13)
        self.gaps = []
        if self.times[0] > 500:  # before the first frame (first page loading)
            self.gaps.append({"t0": 0, "t1": self.times[0] - 250, "edit": "cut", "keep": [0, 0]})
        for a, b in zip(self.frames, self.frames[1:]):
            if b["t"] - a["t"] > 800:
                self.gaps.append({"t0": a["t"] + 250, "t1": b["t"] - 250, "edit": "cut", "keep": [0, 0]})
        # after a tab switch, frames of the old tab that were still captured belong to no step: cut them
        for st in self.steps:
            pg = st["page"]
            idx = [k for k, f in enumerate(self.frames) if f["t"] >= st["t0"]]
            if not idx or self.frames[idx[0]]["page"] == pg:
                continue
            first_new = next((self.frames[k]["t"] for k in idx if self.frames[k]["page"] == pg), None)
            if first_new is not None and first_new - st["t0"] > 120:
                self.gaps.append({"t0": st["t0"], "t1": first_new, "edit": "cut", "keep": [0, 0]})
        if not keep_gaps:
            waits = waits + [g for g in self.gaps
                             if not any(g["t0"] < w["t1"] and w["t0"] < g["t1"] for w in waits)]
        self.total = float(self.tl.get("tEnd") or self.times[-1])
        sc = self.tl["scenario"]
        self.flow = sc.get("flow")
        self.inserts = []
        if sc.get("intro"):
            # t = -1: before everything, including a bridge card on the first step
            self.inserts.append({"t": -1, "ms": sc["intro"].get("ms", 3000), "card": sc["intro"]})
        for s in self.steps:
            if s.get("bridge"):
                self.inserts.append({"t": s["t0"], "ms": s["bridge"].get("ms", 2500), "card": s["bridge"]})
        if sc.get("outro"):
            self.inserts.append({"t": self.total, "ms": sc["outro"].get("ms", 3500), "card": sc["outro"]})
        self.tm = TimeMap(self.total, waits, self.inserts)
        self._card_cache = {}
        self.cursor = []
        for s in self.steps:
            for e in s.get("cursor", []):
                self.cursor.append({**e, "page": s["page"]})
        self.cursor.sort(key=lambda e: e["t"])
        self.fixed = self.tl["scenario"].get("redactFixed") or []

    def frame_path(self, i: int) -> Path:
        return self.dir / "frames" / self.frames[i]["file"]

    def step_at(self, t: float):
        cur = None
        for s in self.steps:
            if s["t0"] <= t:
                cur = s
            else:
                break
        if cur and t <= cur.get("t1", t):
            return cur
        return None

    def state(self, t: float, speed: float = 1.0, burn: bool = True) -> dict:
        st: dict = {"boxes": [], "caption": None, "speed": speed, "cursor": None, "ripple": None, "k": round(self.k, 3)}
        k = self.k
        st["fills"] = [(r["x"] * k, r["y"] * k, (r["x"] + r["w"]) * k, (r["y"] + r["h"]) * k) for r in self.fixed]
        step = self.step_at(t)
        # a step's caption and boxes belong to its own tab: while the previous tab is still the latest frame, show nothing
        if step and self.frames[frame_at(self.times, t)]["page"] != step["page"]:
            step = None
        if step:
            if burn and step.get("caption"):
                st["caption"] = step["caption"]
            ts = step.get("tSettle")
            if ts is not None and ts <= t <= step.get("t1", t):
                for h in step.get("highlights", []):
                    r = h["rect"]
                    st["boxes"].append({"x0": r["x"] * k, "y0": r["y"] * k, "x1": (r["x"] + r["w"]) * k,
                                        "y1": (r["y"] + r["h"]) * k, "n": h.get("n"), "color": h.get("color")})
        # cursor
        last = None
        for e in self.cursor:
            if e["t"] <= t:
                last = e
            else:
                break
        if last and (not step or step["page"] == last["page"]):
            x, y = last["x"] * k, last["y"] * k
            if last["type"] == "move" and t < last["t"] + MOVE_MS:
                fr = last.get("from") or {"x": last["x"] + 160, "y": last["y"] + 110}
                p = (t - last["t"]) / MOVE_MS
                p = p * p * (3 - 2 * p)
                x = (fr["x"] + (last["x"] - fr["x"]) * p) * k
                y = (fr["y"] + (last["y"] - fr["y"]) * p) * k
            st["cursor"] = (round(x), round(y))
            clicks = [e for e in self.cursor if e["type"] == "click" and e["t"] <= t < e["t"] + RIPPLE_MS
                      and e["page"] == last["page"]]
            if clicks:
                c = clicks[-1]
                st["ripple"] = (c["x"] * k, c["y"] * k, round((t - c["t"]) / RIPPLE_MS, 2))
        return st

    def card_image(self, t: float, card: dict) -> Image.Image:
        key = (round(t), json.dumps(card, sort_keys=True, ensure_ascii=False))
        if key not in self._card_cache:
            # background: the last frame before the card (the scene we are leaving)
            i = frame_at(self.times, t - 1)
            with Image.open(self.frame_path(i)) as im:
                self._card_cache = {key: (im.convert("RGB"), draw_card(im, card, self.flow))}
        return self._card_cache[key]

    def render_out(self, out_t: float, burn: bool = True) -> tuple[tuple, Image.Image | None]:
        """Frame for output time out_t. Returns (cache key, image or None if same key as given)."""
        t_src, speed, card, prog = self.tm.at(out_t)
        if card is not None:
            hold = float(card.get("ms", 2500))
            fade = 350.0
            a_in = prog * hold / fade if card.get("_fade_in", True) else 1.0
            a_out = (1 - prog) * hold / fade if card.get("_fade_out", True) else 1.0
            a = min(1.0, a_in, a_out) if hold > 2 * fade else 1.0
            a = round(a, 2)
            key = ("card", round(t_src), json.dumps(card, sort_keys=True, ensure_ascii=False), a, prog >= 0.5)

            def make_card():
                prev, img = self.card_image(t_src, card)
                if a >= 1:
                    return img
                if prog < 0.5:  # fade in from the scene we leave
                    return Image.blend(prev, img, a)
                # fade out into what comes next
                nxt_t = out_t + (1 - prog) * hold + 1
                if nxt_t >= self.tm.out_total or self.tm.at(nxt_t)[2] is not None:
                    return Image.blend(prev, img, a)  # end of video (or another card): fade over the old frame
                _, mk = self.render_out(nxt_t, burn)
                nxt = mk()
                if nxt.size != img.size:
                    nxt = nxt.resize(img.size)
                return Image.blend(nxt, img, a)
            return key, make_card
        i = frame_at(self.times, t_src)
        st = self.state(t_src, speed, burn)
        sw = self.sweep_at(out_t)
        key = (i, json.dumps(st, sort_keys=True, default=str), sw)

        def make():
            with Image.open(self.frame_path(i)) as im:
                out = draw_overlay(im.convert("RGB"), st)
            if sw is not None:
                out = draw_sweep(out, self.flow, sw[1], sw[0])
            return out
        return key, make

    def sweep_at(self, out_t: float):
        """(first, lit) stage indexes while a step with `sweep: [from, to]` is on screen (by output time)."""
        if not self.flow:
            return None
        st = self.flow["stages"]
        for s in self.steps:
            sw = s.get("sweep")
            if not sw:
                continue
            a, b = self.tm.to_out(s["t0"]), self.tm.to_out(s.get("t1", s["t0"]))
            if a <= out_t < b and b > a:
                i0, i1 = st.index(sw[0]), st.index(sw[1])
                p = (out_t - a) / (b - a)
                return (i0, min(i1, i0 + int(p * (i1 - i0 + 1))))
        return None

    def render_at(self, t: float, speed: float = 1.0, burn: bool = True) -> Image.Image:
        i = frame_at(self.times, t)
        with Image.open(self.frame_path(i)) as im:
            return draw_overlay(im.convert("RGB"), self.state(t, speed, burn))


def fmt(ms: float) -> str:
    s = ms / 1000
    return f"{int(s // 60)}:{s % 60:04.1f}"


def srt_time(ms: float) -> str:
    ms = int(round(ms))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def write_srt(pr: Project, path: Path) -> int:
    out = []
    for s in pr.steps:
        if not s.get("caption"):
            continue
        a, b = pr.tm.to_out(s["t0"]), pr.tm.to_out(s.get("t1", s["t0"]))
        if b - a < 200:
            continue
        out.append(f"{len(out) + 1}\n{srt_time(a)} --> {srt_time(b)}\n{s['caption']}\n")
    path.write_text("\n".join(out), encoding="utf-8")
    return len(out)


def pacing_warnings(pr: Project, limit_s: float = 300.0, min_caption_ms: float = 2000.0) -> list[str]:
    """Captions shown too briefly in the output, and total length over the limit."""
    out = []
    for s in pr.steps:
        if not s.get("caption"):
            continue
        a, b = pr.tm.to_out(s["t0"]), pr.tm.to_out(s.get("t1", s["t0"]))
        if b - a < min_caption_ms:
            out.append(f"자막이 짧음 {s['id']}: {(b - a) / 1000:.1f}초 \"{s['caption'][:20]}…\"")
    if pr.tm.out_total > limit_s * 1000:
        out.append(f"영상 길이 {pr.tm.out_total / 1000:.0f}초 > {limit_s:.0f}초")
    return out


def scene_table(pr: Project) -> list[str]:
    scenes: dict[str, float] = {}
    for s in pr.steps:
        d = pr.tm.to_out(s.get("t1", s["t0"])) - pr.tm.to_out(s["t0"])
        scenes[s["scene"] or "-"] = scenes.get(s["scene"] or "-", 0) + d
    return [f"  {k}: {v / 1000:.1f}초" for k, v in scenes.items()] + [f"  합계(영상 길이): {pr.tm.out_total / 1000:.1f}초"]


def cmd_preview(pr: Project):
    picks = []
    sc = pr.tl["scenario"]
    if sc.get("intro"):
        picks.append({"card": sc["intro"], "t": pr.times[0], "id": "intro", "scene": "카드"})
    for s in pr.steps:
        if s.get("bridge"):
            picks.append({"card": s["bridge"], "t": s["t0"], "id": f"{s['id']}-카드", "scene": s["scene"]})
        if s.get("caption") or s.get("highlights"):
            picks.append(s)
    if sc.get("outro"):
        picks.append({"card": sc["outro"], "t": pr.total, "id": "outro", "scene": "카드"})
    pdir = pr.dir / "preview"
    pdir.mkdir(exist_ok=True)
    tw, th = 640, 360
    label_h = 34
    cols = 3
    rows = math.ceil(len(picks) / cols) or 1
    sheet = Image.new("RGB", (cols * (tw + 12) + 12, rows * (th + label_h + 12) + 12), (245, 245, 247))
    d = ImageDraw.Draw(sheet)
    f = font(18, bold=False)
    warns = []
    for n, s in enumerate(picks):
        if "card" in s:
            img = pr.card_image(s["t"], s["card"])[1]
            img.save(pdir / f"{n + 1:02d}-{s['id']}.jpg", quality=88)
            x = 12 + (n % cols) * (tw + 12)
            y = 12 + (n // cols) * (th + label_h + 12)
            d.text((x, y + 6), f"{s['id']} · {fmt(pr.tm.to_out(s['t']) - (s['card'].get('ms', 2500) if s['id'] != 'intro' else 0))} · {s['card'].get('ms', 2500) / 1000:.1f}초", font=f, fill=(30, 30, 30))
            sheet.paste(img.resize((tw, th), Image.LANCZOS), (x, y + label_h))
            continue
        ts = s.get("tSettle", s["t0"])
        t = ts + 0.6 * (s.get("t1", ts) - ts)
        img = pr.render_at(t)
        img.save(pdir / f"{n + 1:02d}-{s['id']}.jpg", quality=88)
        x = 12 + (n % cols) * (tw + 12)
        y = 12 + (n // cols) * (th + label_h + 12)
        moved = any(h.get("moved") or h["rect"].get("covered") for h in s.get("highlights", []))
        dur = (pr.tm.to_out(s.get("t1", s["t0"])) - pr.tm.to_out(s["t0"])) / 1000
        label = f"{s['id']} · {s['scene']} · {fmt(pr.tm.to_out(s['t0']))} · {dur:.1f}초" + ("  ⚠ 상자 위치 바뀜/가려짐" if moved else "")
        if moved:
            warns.append(s["id"])
        d.text((x, y + 6), label, font=f, fill=(200, 40, 20) if moved else (30, 30, 30))
        sheet.paste(img.resize((tw, th), Image.LANCZOS), (x, y + label_h))
    sheet.save(pr.dir / "preview.png")
    print(f"미리보기: {pr.dir / 'preview.png'} (칸 {len(picks)}개, 낱장 {pdir})")
    if warns:
        print("경고: 상자가 움직였거나 가려짐:", ", ".join(warns))
    print("장면별 길이:")
    print("\n".join(scene_table(pr)))


def cmd_transitions(pr: Project):
    """First 3 frames after every page switch or capture gap: check by eye that nothing unredacted slipped in."""
    picks = [0]
    for i in range(1, len(pr.frames)):
        a, b = pr.frames[i - 1], pr.frames[i]
        if b["page"] != a["page"] or b["t"] - a["t"] > 300:
            picks.append(i)
    idx = []
    for i in picks:
        idx += [j for j in range(i, min(i + 3, len(pr.frames))) if j not in idx]
    tw, th, label_h, cols = 480, 270, 26, 3
    rows = math.ceil(len(idx) / cols)
    sheet = Image.new("RGB", (cols * (tw + 8) + 8, rows * (th + label_h + 8) + 8), (245, 245, 247))
    d = ImageDraw.Draw(sheet)
    f = font(16, bold=False)
    for n, i in enumerate(idx):
        x, y = 8 + (n % cols) * (tw + 8), 8 + (n // cols) * (th + label_h + 8)
        fr = pr.frames[i]
        d.text((x, y + 4), f"#{fr['i']} · {fr['page']} · {fmt(fr['t'])}", font=f, fill=(30, 30, 30))
        with Image.open(pr.frame_path(i)) as im:
            sheet.paste(im.convert("RGB").resize((tw, th), Image.LANCZOS), (x, y + label_h))
    sheet.save(pr.dir / "transitions.png")
    print(f"전환 직후 프레임: {pr.dir / 'transitions.png'} (전환 {len(picks)}곳, {len(idx)}장)")


def cmd_render(pr: Project, burn: bool, scale: float):
    import imageio_ffmpeg

    fps = int(pr.tl["scenario"].get("output", {}).get("fps", 30))
    W, H = pr.src_size
    if scale != 1:
        W, H = int(W * scale) // 2 * 2, int(H * scale) // 2 * 2
    out = pr.dir / (getattr(pr, "name", None) or ("video.mp4" if burn else "video-clean.mp4"))
    n_frames = max(1, int(math.ceil(pr.tm.out_total / 1000 * fps)))
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    last_key, last_bytes = None, None
    for n in range(n_frames):
        key, make = pr.render_out(n * 1000 / fps, burn)
        if key != last_key:
            img = make()
            if img.size != (W, H):
                img = img.resize((W, H), Image.LANCZOS)
            last_key, last_bytes = key, img.tobytes()
        proc.stdin.write(last_bytes)
        if n % (fps * 10) == 0:
            print(f"  {n}/{n_frames}", flush=True)
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg 실패")
    srt = out.with_suffix(".srt")
    cnt = write_srt(pr, srt)
    print(f"영상: {out} ({W}x{H}, {fps}fps, {n_frames / fps:.1f}초, 원본 {pr.total / 1000:.1f}초)")
    print(f"자막: {srt} ({cnt}개)")
    print("\n".join(scene_table(pr)))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["preview", "render", "transitions"])
    ap.add_argument("out_dir")
    ap.add_argument("--no-burn", action="store_true")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--wait-edit", help="모든 기다림 구간 처리를 덮어씀: keep | cut | speed:8")
    ap.add_argument("--name", help="영상 파일 이름 (기본 video.mp4)")
    ap.add_argument("--keep-gaps", action="store_true", help="페이지 로딩 중 멈춘 구간을 줄이지 않음")
    a = ap.parse_args()
    we = a.wait_edit
    if we and we.startswith("speed:"):
        we = {"speed": float(we.split(":")[1])}
    pr = Project(Path(a.out_dir), we, a.keep_gaps)
    pr.name = a.name
    if a.cmd == "preview":
        cmd_preview(pr)
    elif a.cmd == "transitions":
        cmd_transitions(pr)
    else:
        cmd_render(pr, not a.no_burn, a.scale)


if __name__ == "__main__":
    main()
