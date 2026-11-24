import sys
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent / "editor"))
from draw import caption_box, draw_overlay, font, wrap  # noqa: E402


class DrawTest(unittest.TestCase):
    def test_wrap_two_lines_max(self):
        f = font(40)
        lines = wrap("가나다라마바사 " * 40, f, 800)
        self.assertEqual(len(lines), 2)
        self.assertTrue(lines[-1].endswith("…"))
        self.assertTrue(all(f.getlength(l) <= 800 for l in lines))

    def test_wrap_long_word(self):
        lines = wrap("가" * 60, font(40), 600)
        self.assertGreaterEqual(len(lines), 2)

    def test_caption_moves_up_when_box_overlaps(self):
        img = Image.new("RGB", (1920, 1080), "white")
        bottom, *_ = caption_box(img.size, "자막")
        box = {"x0": 0, "y0": bottom[1], "x1": 1920, "y1": bottom[3], "n": 1}
        out = draw_overlay(img, {"boxes": [box], "caption": "자막"})
        # band moved to the top: top-centre pixel is dark, bottom-centre is not
        self.assertLess(sum(out.getpixel((960, 70))), 300)
        self.assertGreater(sum(out.getpixel((960, bottom[1] + 5))), 600)


if __name__ == "__main__":
    unittest.main()
