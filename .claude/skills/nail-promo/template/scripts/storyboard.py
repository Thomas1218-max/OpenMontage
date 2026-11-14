"""Labelled storyboard sheet from a rendered preview (+ B-hook stills + cover) for the approval gate.

usage: python projects/<slug>/scripts/storyboard.py <lang> <preview_A.mp4> <out.jpg>
"""
import subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import load_promo, build_props, remotion_still  # noqa: E402
from PIL import Image, ImageDraw, ImageFont

lang, video, out = sys.argv[1], Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve()
T = load_promo()["timeline"]
mid = lambda a, b: (T[a] + T[b]) // 2
shots = [("1 A", 10), ("1 A", T["S2"] - 15), ("2", T["S2"] + 45), ("3", T["S3"] + 30), ("3", T["S4"] - 25),
         ("4", mid("S4", "S5")), ("5", mid("S5", "S6")), ("5>6", T["S6"] - 8)]
shots += [(f"6 #{i+1}", T["S6"] + i * T["PHOTO"] + T["PHOTO"] // 2) for i in range(max(0, (T["S7"] - T["S6"]) // T["PHOTO"]))]
shots += [("7 CTA", T["S7"] + 40), ("7 outro", T["END"] - 6)]
tmp = Path(tempfile.mkdtemp())
tiles = []
for i, (label, f) in enumerate(shots):
    p = tmp / f"{i}.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf", f"select=eq(n\\,{f})", "-frames:v", "1", str(p)], check=True)
    tiles.append((p, f"镜头{label} {f/30:.1f}s"))
propsB = build_props(lang, "B")
for f, label in [(10, "镜头1 B 0.3s"), (T["S2"] - 15, f"镜头1 B {(T['S2']-15)/30:.1f}s")]:
    p = tmp / f"B{f}.png"; remotion_still("NailPromo", p, propsB, f); tiles.append((p, label))
p = tmp / "cover.png"; remotion_still("Cover", p, build_props(lang, "A")); tiles.append((p, "封面 cover"))
W, H, pad, cols = 300, 533, 46, 6
rows = (len(tiles) + cols - 1) // cols
font = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 24, index=2)
sheet = Image.new("RGB", (cols * W + (cols + 1) * 12, rows * (H + pad) + 12), "#FBF6F1"); dr = ImageDraw.Draw(sheet)
for i, (p, label) in enumerate(tiles):
    x = 12 + (i % cols) * (W + 12); y = 12 + (i // cols) * (H + pad)
    sheet.paste(Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS), (x, y + pad - 8))
    dr.text((x + 4, y + 4), label, fill="#4A302B", font=font)
sheet.save(out, quality=88)
print("storyboard:", out)
