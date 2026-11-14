"""Build public/ from promo.json: trimmed/speed-changed clips, cleaned photos, fonts, SFX, mixed soundtrack.

usage: python -I projects/<slug>/scripts/prep_media.py
"""
import json, shutil, subprocess, sys, wave
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import PROJ, load_promo  # noqa: E402

import numpy as np
from PIL import Image

promo = load_promo()
pub = PROJ / "public"
pub.mkdir(exist_ok=True)
FPS = 30

# 1. Clips: -ss/-t BEFORE -i so they cut SOURCE time; speed via setpts; optional freeze-frame tail.
for key, c in promo["clips"].items():
    vf = f"setpts=PTS/{c.get('speed', 1.0)},fps={FPS},scale=1080:1920,setsar=1"
    if c.get("freeze"):
        vf += f",tpad=stop_mode=clone:stop_duration={c['freeze']}"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(c["start"]), "-t", str(c["dur"]), "-i", str(PROJ / c["src"]),
                    "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-r", str(FPS),
                    "-vf", vf, str(pub / f"{key}.mp4")], check=True)
    print("clip", key, "->", round(c["dur"] / c.get("speed", 1.0) + c.get("freeze", 0), 2), "s")

# 2. Photos: crop letterbox bars (screenshots/reposts often have them), width 1080, record aspect.
aspects = {}
for src in promo["photos"]:
    im = Image.open(PROJ / src)
    from PIL import ImageOps
    im = ImageOps.exif_transpose(im).convert("RGB")
    rows = np.asarray(im.convert("L")).astype(float).mean(1)
    top, bot = 0, len(rows)
    while top < bot and rows[top] < 12: top += 1
    while bot > top and rows[bot - 1] < 12: bot -= 1
    if top > 0 or bot < len(rows):
        im = im.crop((0, top + 2, im.width, bot - 2))
    im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
    name = Path(src).stem + ".jpg"
    im.save(pub / name, quality=94)
    aspects[name] = im.height / 1080
    print("photo", name, im.size, "bars cropped" if top or bot < len(rows) else "")
(pub / "media.json").write_text(json.dumps(aspects, indent=1))

# 3. Fonts (Be Vietnam Pro for Latin/Vietnamese; CJK uses system Noto Sans CJK).
fonts_src = PROJ / "fonts"
if fonts_src.is_dir():
    shutil.copytree(fonts_src, pub / "fonts", dirs_exist_ok=True)

# 4. SFX synthesized locally (no licensing): ding = bell partials, dong = pitch-drop thump, shimmer = rising chimes.
SR = 48000
def save(name, x):
    d = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(pub / f"sfx_{name}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
t = np.arange(int(1.4 * SR)) / SR
ding = sum(w * np.sin(2 * np.pi * f * t) * np.exp(-t / dd) for f, w, dd in [(1760, 1, .45), (2640, .45, .3), (3520, .3, .2), (5280, .12, .12)])
ding *= np.minimum(t / .003, 1); save("ding", ding / np.abs(ding).max() * .55)
t = np.arange(int(.7 * SR)) / SR
ph = 2 * np.pi * np.cumsum(55 + 110 * np.exp(-t / .05)) / SR
dong = np.sin(ph) * np.exp(-t / .18) * np.minimum(t / .002, 1) + np.random.default_rng(1).standard_normal(len(t)) * np.exp(-t / .012) * .35
save("dong", dong / np.abs(dong).max() * .9)
t = np.arange(int(1.2 * SR)) / SR; sh = np.zeros(len(t))
for i, fr in enumerate([2093, 2637, 3136, 3951, 4699]):
    s = int(i * .06 * SR); tt = t[:len(t) - s]
    sh[s:] += np.sin(2 * np.pi * fr * tt) * np.exp(-tt / .35) * np.minimum(tt / .002, 1)
save("shimmer", sh / np.abs(sh).max() * .3)

# 5. Soundtrack = music excerpt + SFX, loudness-normalised to -14 LUFS (social standard).
m = promo["music"]
dur = promo["timeline"]["END"] / FPS
fade_at = dur - m.get("fade_out", 1.4)
sfx = promo.get("sfx", {})
inputs, chains, labels = ["-ss", str(m["start"]), "-t", f"{dur:.3f}", "-i", str(PROJ / m["file"])], [], ["[m]"]
chains.append(f"[0:a]aresample=48000,volume={m.get('volume', .8)},afade=t=out:st={fade_at:.3f}:d={m.get('fade_out', 1.4)}[m]")
for i, (name, at) in enumerate(sfx.items(), start=1):
    inputs += ["-i", str(pub / f"sfx_{name}.wav")]
    ms = int(at * 1000)
    chains.append(f"[{i}:a]adelay={ms}|{ms}[s{i}]"); labels.append(f"[s{i}]")
graph = ";".join(chains) + ";" + "".join(labels) + f"amix=inputs={len(labels)}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[out]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[out]", "-c:a", "pcm_s16le", "-ac", "2",
                str(pub / "soundtrack.wav")], check=True)
print("soundtrack", round(dur, 2), "s; sfx", sfx)
