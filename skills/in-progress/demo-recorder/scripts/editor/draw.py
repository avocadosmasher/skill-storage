"""Overlay drawing: highlight boxes with numbers, captions, speed badge, cursor and click ripple."""
from __future__ import annotations

from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf"
FONT = "C:/Windows/Fonts/malgun.ttf"
BOX_COLOR = (255, 86, 48)  # #FF5630


@lru_cache(maxsize=16)
def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def hex_rgb(c: str | None, default=BOX_COLOR):
    if not c:
        return default
    c = c.lstrip("#")
    return tuple(int(c[i : i + 2], 16) for i in (0, 2, 4))


def wrap(text: str, fnt, max_w: int, max_lines: int = 2) -> list[str]:
    """Wrap by pixel width. Prefer breaking at spaces; fall back to characters (Korean)."""
    words = text.split(" ")
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if fnt.getlength(trial) <= max_w:
            cur = trial
            continue
        if cur:
            lines.append(cur)
        cur = ""
        for ch in w:  # a single word longer than the line
            if fnt.getlength(cur + ch) > max_w:
                lines.append(cur)
                cur = ch
            else:
                cur += ch
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[: max_lines - 1] + [" ".join(lines[max_lines - 1 :])]
        while fnt.getlength(lines[-1] + "…") > max_w and len(lines[-1]) > 1:
            lines[-1] = lines[-1][:-1]
        lines[-1] += "…"
    return lines


def caption_box(size: tuple[int, int], text: str, at_top: bool = False):
    """Return (rect, lines, font, line_h) for the caption band."""
    W, H = size
    s = H / 1080
    fnt = font(int(40 * s))
    lines = wrap(text, fnt, int(W * 0.82))
    line_h = int(56 * s)
    pad_x, pad_y = int(36 * s), int(18 * s)
    tw = max(fnt.getlength(l) for l in lines)
    bw, bh = int(tw + 2 * pad_x), int(len(lines) * line_h + 2 * pad_y)
    x0 = (W - bw) // 2
    y0 = int(40 * s) if at_top else H - bh - int(48 * s)
    return (x0, y0, x0 + bw, y0 + bh), lines, fnt, line_h, pad_y


def overlaps(a, b) -> bool:
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def draw_overlay(base: Image.Image, state: dict) -> Image.Image:
    """state: {boxes:[{x0,y0,x1,y1,n,color}], caption, speed, cursor:(x,y)|None, ripple:(x,y,p)|None, fills:[rect]}
    Box/cursor coordinates are frame pixels."""
    W, H = base.size
    s = H / 1080
    img = base.convert("RGBA")
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    for r in state.get("fills", []):
        d.rectangle(r, fill=(40, 40, 40, 255))

    boxes = state.get("boxes", [])
    for b in boxes:
        col = hex_rgb(b.get("color"))
        # page zoom: k = frame px per CSS px (1.5 at 150 %, 1.0 at 100 %). Box padding and number follow the page, not the frame
        k = float(state.get("k", 1.5))
        pad = max(3, int(4 * k))
        rect = (b["x0"] - pad, b["y0"] - pad, b["x1"] + pad, b["y1"] + pad)
        d.rounded_rectangle(rect, radius=int(8 * s), outline=col + (255,), width=max(3, int(4 * s)))
        if b.get("n"):
            rad = max(10, int(13 * k))
            # sit outside the top-left corner so the number never covers what the box points at
            cx = max(rad + 2, rect[0] - int(rad * 0.75))
            cy = max(rad + 2, rect[1] - int(rad * 0.75))
            d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=col + (255,), outline=(255, 255, 255, 255), width=max(2, int(2 * s)))
            f = font(max(12, int(17 * k)))
            t = str(b["n"])
            d.text((cx, cy), t, font=f, fill=(255, 255, 255, 255), anchor="mm")

    cap = state.get("caption")
    if cap:
        rect, lines, fnt, line_h, pad_y = caption_box(img.size, cap)
        if any(overlaps(rect, (b["x0"], b["y0"], b["x1"], b["y1"])) for b in boxes):
            rect, lines, fnt, line_h, pad_y = caption_box(img.size, cap, at_top=True)
        d.rounded_rectangle(rect, radius=int(14 * s), fill=(15, 15, 20, 200))
        cx = (rect[0] + rect[2]) / 2
        for i, line in enumerate(lines):
            d.text((cx, rect[1] + pad_y + i * line_h + line_h / 2), line, font=fnt, fill=(255, 255, 255, 255), anchor="mm")

    sp = state.get("speed")
    if sp and sp != 1:
        f = font(int(30 * s))
        t = f"{sp:g}배속"
        tw = f.getlength(t)
        x1, y0 = W - int(30 * s), int(30 * s)
        d.rounded_rectangle((x1 - tw - int(40 * s), y0, x1, y0 + int(54 * s)), radius=int(10 * s), fill=(15, 15, 20, 200))
        d.text((x1 - int(20 * s) - tw / 2, y0 + int(27 * s)), t, font=f, fill=(255, 255, 255, 255), anchor="mm")

    rp = state.get("ripple")
    if rp:
        x, y, p = rp
        rad = int((12 + 38 * p) * s)
        a = int(220 * (1 - p))
        d.ellipse((x - rad, y - rad, x + rad, y + rad), outline=BOX_COLOR + (a,), width=max(3, int(5 * s)))

    cur = state.get("cursor")
    if cur:
        x, y = cur
        k = 1.6 * s
        pts = [(0, 0), (0, 17), (4.5, 13), (7.5, 20), (10, 19), (7, 12.5), (12.5, 12.5)]
        poly = [(x + px * k, y + py * k) for px, py in pts]
        d.polygon(poly, fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=max(2, int(2 * s)))

    img.alpha_composite(ov)
    return img.convert("RGB")


# ---------- bridge / title cards ----------
ACTIVE = (255, 86, 48)
IDLE = (60, 64, 72)
DONE = (122, 58, 44)  # stages already passed: dim orange


def _flow_strip(d, y, W, s, flow: dict, active: set, done: set | None = None):
    stages = flow.get("stages") or []
    n = len(stages)
    if not n:
        return
    gap = int(22 * s)
    bw = min(int(168 * s), int((W * 0.92 - (n - 1) * gap) / n))
    bh = int(74 * s)
    x0 = (W - (n * bw + (n - 1) * gap)) // 2
    numbered = set(flow.get("numbered") or [])
    f = font(int(24 * s))
    fn = font(int(16 * s), bold=False)
    num = 0
    for i, name in enumerate(stages):
        x = x0 + i * (bw + gap)
        on = name in active or i in active
        was = not on and done is not None and name in done
        d.rounded_rectangle((x, y, x + bw, y + bh), radius=int(12 * s), fill=ACTIVE if on else DONE if was else IDLE)
        d.text((x + bw / 2, y + bh / 2), name, font=f, fill=(255, 255, 255) if on else (235, 200, 190) if was else (190, 194, 200), anchor="mm")
        if name in numbered:
            num += 1
            d.text((x + int(10 * s), y + int(6 * s)), str(num), font=fn, fill=(255, 255, 255) if on else (150, 150, 160))
        if i < n - 1:
            d.text((x + bw + gap / 2, y + bh / 2), "›", font=font(int(28 * s)), fill=(150, 154, 160), anchor="mm")
    span = flow.get("span")  # [first, last] stage names under a bracket
    if span and span[0] in stages and span[1] in stages:
        a, b = stages.index(span[0]), stages.index(span[1])
        sx0, sx1 = x0 + a * (bw + gap), x0 + b * (bw + gap) + bw
        yy = y + bh + int(16 * s)
        d.line((sx0, yy, sx1, yy), fill=(120, 124, 130), width=max(1, int(2 * s)))
        if flow.get("note"):
            d.text(((sx0 + sx1) / 2, yy + int(18 * s)), flow["note"], font=fn, fill=(170, 174, 180), anchor="mm")


def draw_card(bg: Image.Image, card: dict, flow: dict | None) -> Image.Image:
    """Full-frame bridge card over a blurred, darkened background frame.
    card: {kicker?, title, sub?, active?: [stage names]}"""
    from PIL import ImageFilter

    W, H = bg.size
    s = H / 1080
    im = bg.convert("RGB").filter(ImageFilter.GaussianBlur(int(14 * s) or 1)).convert("RGBA")
    im.alpha_composite(Image.new("RGBA", im.size, (10, 12, 18, 190)))
    im = im.convert("RGB")
    d = ImageDraw.Draw(im)
    has_flow = bool(flow and flow.get("stages") and card.get("active") is not None)
    cy = int((400 if has_flow else 470) * s)
    if card.get("kicker"):
        d.text((W / 2, cy - int(70 * s)), card["kicker"], font=font(int(34 * s), bold=False), fill=(170, 180, 195), anchor="mm")
    d.text((W / 2, cy), card.get("title", ""), font=font(int(64 * s)), fill=(255, 255, 255), anchor="mm")
    if card.get("sub"):
        d.text((W / 2, cy + int(80 * s)), card["sub"], font=font(int(30 * s), bold=False), fill=(215, 220, 226), anchor="mm")
    if has_flow:
        act = card.get("active")
        active = set(flow["stages"]) if act == "all" else set(act or [])
        done = None
        if flow.get("progress", True):
            dn = card.get("done")
            if dn == "all":
                done = set(flow["stages"])
            elif dn is not None:
                done = set(dn)
            else:  # everything left of the first active stage has been passed
                idx = [flow["stages"].index(a) for a in active if a in flow["stages"]]
                done = set(flow["stages"][: min(idx)]) if idx else set()
        _flow_strip(d, int(640 * s), W, s, flow, active, done)
    return im


def draw_sweep(img: Image.Image, flow: dict, lit: int, first: int) -> Image.Image:
    """Compact flow band at the top: stages first..lit are on (used while the service works)."""
    W, H = img.size
    s = H / 1080 * 0.62
    im = img.convert("RGBA")
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    bh = int(74 * s) + int(40 * H / 1080)
    od.rounded_rectangle((int(W * 0.04), int(14 * H / 1080), int(W * 0.96), int(14 * H / 1080) + bh), radius=int(14 * H / 1080), fill=(12, 14, 20, 215))
    im.alpha_composite(ov)
    im = im.convert("RGB")
    d = ImageDraw.Draw(im)
    st = flow["stages"]
    active = set(st[first : lit + 1])
    done = set(st[:first])
    _flow_strip(d, int(34 * H / 1080), W, s, {**flow, "span": None}, active, done)
    return im
