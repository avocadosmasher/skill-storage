import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "editor"))
from timemap import TimeMap, frame_at  # noqa: E402


class TimeMapTest(unittest.TestCase):
    def test_keep(self):
        tm = TimeMap(10000, [])
        self.assertEqual(tm.out_total, 10000)
        self.assertEqual(tm.to_src(2500)[0], 2500)

    def test_cut(self):
        tm = TimeMap(20000, [{"t0": 5000, "t1": 13000, "edit": "cut", "keep": [1000, 1000]}])
        self.assertEqual(tm.out_total, 20000 - 6000)
        self.assertEqual(tm.to_src(5500)[0], 5500)  # inside the head
        self.assertEqual(tm.to_src(6500)[0], 12500)  # jumped over the cut
        self.assertEqual(tm.to_out(9000), 6000)  # a time inside the cut maps to the cut point
        self.assertEqual(tm.to_out(20000), 14000)

    def test_cut_shorter_than_keep_is_kept(self):
        tm = TimeMap(5000, [{"t0": 1000, "t1": 2500, "edit": "cut", "keep": [1000, 1000]}])
        self.assertEqual(tm.out_total, 5000)

    def test_speed(self):
        tm = TimeMap(10000, [{"t0": 2000, "t1": 10000, "edit": {"speed": 8}}])
        self.assertEqual(tm.out_total, 2000 + 1000)
        src, sp = tm.to_src(2500)
        self.assertEqual((src, sp), (6000, 8))
        self.assertEqual(tm.to_src(1000)[1], 1.0)

    def test_card_insert(self):
        tm = TimeMap(10000, [], [{"t": 4000, "ms": 2000, "card": {"title": "x"}}])
        self.assertEqual(tm.out_total, 12000)
        self.assertEqual(tm.at(3000)[0], 3000)
        src, _, card, prog = tm.at(5000)
        self.assertEqual((src, card["title"], prog), (4000, "x", 0.5))
        self.assertEqual(tm.at(7000)[0], 5000)
        self.assertEqual(tm.to_out(4000), 6000)  # a step starting at the card comes after it

    def test_card_at_ends(self):
        tm = TimeMap(10000, [], [{"t": 0, "ms": 1000, "card": {"a": 1}}, {"t": 10000, "ms": 1000, "card": {"b": 1}}])
        self.assertEqual(tm.out_total, 12000)
        self.assertIsNotNone(tm.at(500)[2])
        self.assertIsNotNone(tm.at(11500)[2])
        self.assertIsNone(tm.at(5000)[2])

    def test_card_inside_cut(self):
        tm = TimeMap(20000, [{"t0": 5000, "t1": 13000, "edit": "cut", "keep": [1000, 1000]}],
                     [{"t": 9000, "ms": 2000, "card": {"c": 1}}])
        self.assertEqual(tm.out_total, 16000)

    def test_frame_at(self):
        self.assertEqual(frame_at([0, 40, 80], 79), 1)
        self.assertEqual(frame_at([10, 40], 0), 0)
        self.assertEqual(frame_at([10, 40], 999), 1)


if __name__ == "__main__":
    unittest.main()
