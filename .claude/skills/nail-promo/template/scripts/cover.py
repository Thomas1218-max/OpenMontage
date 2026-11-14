"""Render the 1080x1920 cover still. usage: python projects/<slug>/scripts/cover.py <lang> <out.jpg>"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import build_props, remotion_still  # noqa: E402
from PIL import Image

lang, out = sys.argv[1], Path(sys.argv[2]).resolve()
png = out.with_suffix(".png")
remotion_still("Cover", png, build_props(lang, "A"))
Image.open(png).convert("RGB").save(out, quality=95)
png.unlink()
print("cover:", out)
