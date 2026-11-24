"""Source time <-> output time mapping: wait segments (cut / speed / keep) and inserted cards. Pure functions, ms."""
from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass, field


@dataclass
class Piece:
    s0: float  # source start (ms)
    s1: float  # source end
    rate: float  # output ms per source ms (1 = normal, 1/k = k-times faster, 0 = cut)
    speed: float = 1.0  # label for the speed badge (k), 1 when normal
    card: dict | None = field(default=None)  # inserted card: source time is frozen at s0
    hold: float = 0.0  # output length of a card

    @property
    def out_len(self) -> float:
        return self.hold if self.card is not None else (self.s1 - self.s0) * self.rate


def build_pieces(total: float, waits: list[dict], inserts: list[dict] | None = None) -> list[Piece]:
    """waits: [{t0, t1, edit, keep:[head, tail]}] in source ms. inserts: [{t, ms, card}].
    Returns pieces over [0, total] with cards spliced in at their source time."""
    pieces: list[Piece] = []
    cur = 0.0
    for w in sorted(waits, key=lambda w: w["t0"]):
        t0, t1 = max(cur, float(w["t0"])), min(total, float(w["t1"]))
        if t1 <= t0:
            continue
        if t0 > cur:
            pieces.append(Piece(cur, t0, 1.0))
        edit = w.get("edit", "keep")
        if edit == "keep":
            pieces.append(Piece(t0, t1, 1.0))
        elif edit == "cut":
            head, tail = (w.get("keep") or [1000, 1000])[:2]
            if head + tail >= t1 - t0:
                pieces.append(Piece(t0, t1, 1.0))
            else:
                if head:
                    pieces.append(Piece(t0, t0 + head, 1.0))
                pieces.append(Piece(t0 + head, t1 - tail, 0.0))
                if tail:
                    pieces.append(Piece(t1 - tail, t1, 1.0))
        elif isinstance(edit, dict) and edit.get("speed"):
            k = float(edit["speed"])
            pieces.append(Piece(t0, t1, 1.0 / k, k))
        else:
            raise ValueError(f"unknown edit {edit!r}")
        cur = t1
    if cur < total or not pieces:
        pieces.append(Piece(cur, total, 1.0))
    for ins in sorted(inserts or [], key=lambda x: x["t"], reverse=False):
        first = float(ins["t"]) < 0
        t = min(max(0.0, float(ins["t"])), total)
        card = Piece(t, t, 0.0, card=ins["card"], hold=float(ins["ms"]))
        if first:
            pieces.insert(0, card)
            continue
        for k, p in enumerate(pieces):
            if p.card is not None:
                continue
            if p.s0 <= t < p.s1 or (t == p.s1 == total and k == len(pieces) - 1) or (t == p.s0):
                if t == p.s0:
                    # place after any card already at this time
                    j = k
                    while j > 0 and pieces[j - 1].card is not None and pieces[j - 1].s0 == t:
                        j -= 1
                    while j < len(pieces) and pieces[j].card is not None:
                        j += 1
                    pieces.insert(j, card)
                elif t == p.s1:
                    pieces.insert(k + 1, card)
                else:
                    a = Piece(p.s0, t, p.rate, p.speed)
                    b = Piece(t, p.s1, p.rate, p.speed)
                    pieces[k : k + 1] = [a, card, b]
                break
    return pieces


class TimeMap:
    def __init__(self, total: float, waits: list[dict], inserts: list[dict] | None = None):
        self.pieces = build_pieces(total, waits, inserts)
        self.out_starts = []
        acc = 0.0
        for p in self.pieces:
            self.out_starts.append(acc)
            acc += p.out_len
        self.out_total = acc
        # back-to-back cards switch directly: no fade through the page in between
        solid = [k for k, p in enumerate(self.pieces) if p.out_len >= 150 or p.card is not None]
        self.fade = {}
        for n, k in enumerate(solid):
            if self.pieces[k].card is None:
                continue
            prev_card = n > 0 and self.pieces[solid[n - 1]].card is not None
            next_card = n + 1 < len(solid) and self.pieces[solid[n + 1]].card is not None
            self.fade[k] = (not prev_card, not next_card)

    def at(self, out_t: float):
        """Output time -> (source time, speed label, card or None, card progress 0..1)."""
        last = len(self.pieces) - 1
        for k, (p, o) in enumerate(zip(self.pieces, self.out_starts)):
            if p.out_len == 0 and k != last:
                continue
            if out_t < o + p.out_len or k == last:
                if p.card is not None:
                    fi, fo = self.fade.get(k, (True, True))
                    card = {**p.card, "_fade_in": fi, "_fade_out": fo}
                    return p.s0, 1.0, card, min(1.0, max(0.0, (out_t - o) / p.hold)) if p.hold else 1.0
                if p.rate == 0:
                    return p.s1, 1.0, None, 0.0
                return min(p.s1, p.s0 + (out_t - o) / p.rate), p.speed, None, 0.0
        return 0.0, 1.0, None, 0.0

    def to_src(self, out_t: float) -> tuple[float, float]:
        src, speed, _, _ = self.at(out_t)
        return src, speed

    def to_out(self, src_t: float) -> float:
        """Source time -> output time. A card at time t comes before source time t."""
        last = len(self.pieces) - 1
        for k, (p, o) in enumerate(zip(self.pieces, self.out_starts)):
            if p.card is not None:
                if src_t < p.s0:
                    return o
                continue
            if src_t < p.s1 or (k == last and src_t <= p.s1):
                return o + max(0.0, src_t - p.s0) * p.rate
        return self.out_total


def frame_at(times: list[float], t: float) -> int:
    """Index of the last frame with time <= t (0 if t is before the first frame)."""
    return max(0, bisect_right(times, t) - 1)
