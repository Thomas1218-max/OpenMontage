#!/usr/bin/env python3
"""Cat-punch loop builder: one cat photo -> only the fist zooms to fill the screen.

Usage (from repo root):
  python .claude/skills/cat-punch/scripts/build_cat_punch.py \
      --image <punch_photo.png> --project cat-punch-loop \
      --paw-box 520,400,940,760 --paw-center 715,590 \
      [--cut 555,545,690,430] [--speed 5] [--duration 20] [--render]

Writes projects/<project>/hyperframes/{index.html,assets/*}; --render also renders
projects/<project>/renders/final_<speed>x_<duration>s.mp4 (needs npx hyperframes).
"""
import argparse, math, os, shutil, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
CYCLE = 1.25  # seconds of source per punch (at 1x)


def segment_paw(im, box, center, cut):
    W, H = im.size
    hsv = np.array(im.convert("HSV")).astype(float)
    Hh, S, V = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    x0, y0, x1, y1 = box
    inbox = np.zeros(S.shape, bool); inbox[y0:y1, x0:x1] = True
    notbg = (S > 0.10) | (V < 0.9)                       # not the white backdrop
    red = ((Hh < 14) | (Hh > 340)) & (S > 0.55)          # clothing red -> exclude
    m = ndi.binary_opening(inbox & notbg & ~red, iterations=2)
    lab, _ = ndi.label(m)
    cx, cy = center
    m = lab == lab[cy, cx]
    m = ndi.binary_fill_holes(ndi.binary_closing(m, iterations=6))
    if cut:  # drop face/cheek fur above a line (x1,y1,x2,y2)
        ax, ay, bx, by = cut
        yy, xx = np.mgrid[0:H, 0:W]
        line_y = ay + (xx - ax) * (by - ay) / (bx - ax)
        m &= ~((yy < line_y) & (xx < max(ax, bx) + 70))
    m = ndi.binary_opening(m, iterations=3)
    lab, _ = ndi.label(m); m = lab == lab[cy, cx]
    m = ndi.binary_erosion(m, iterations=3)
    return m


def make_layers(img_path, hf, box, center, cut):
    im = Image.open(img_path).convert("RGB"); W, H = im.size
    im.save(os.path.join(hf, "assets", "cat_body.png"))
    m = segment_paw(im, box, center, cut)
    alpha = Image.fromarray((m * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(2.5))
    paw = im.copy(); paw.putalpha(alpha); paw.save(os.path.join(hf, "assets", "paw.png"))
    # radial zoom blur on premultiplied paw
    A = np.array(paw).astype(float) / 255
    P = np.dstack([A[..., :3] * A[..., 3:4], A[..., 3:4]])
    acc = np.zeros_like(P); N = 14; cx, cy = center
    for i in range(N):
        s = 1 + 0.22 * i / (N - 1)
        acc += cv2.warpAffine(P, np.array([[s, 0, cx - cx * s], [0, s, cy - cy * s]]), (W, H), flags=cv2.INTER_LINEAR)
    acc = cv2.GaussianBlur(acc / N, (0, 0), 14)
    al = acc[..., 3:4]; rgb = np.where(al > 1e-4, acc[..., :3] / np.maximum(al, 1e-4), 0)
    Image.fromarray((np.clip(np.dstack([rgb, al]), 0, 1) * 255).astype("uint8"), "RGBA").save(os.path.join(hf, "assets", "paw_blur.png"))
    return W, H, int(m.sum())


def make_sfx(path, cycles, speed):
    sr = 44100; src_len = cycles * CYCLE; n = int(sr * src_len)
    rng = np.random.default_rng(7); out = np.zeros(n)
    def add(sig, t):
        i = int(t * sr); k = min(len(sig), n - i)
        if k > 0: out[i:i + k] += sig[:k]
    def whoosh(L=0.26):
        t = np.arange(int(sr * L)) / sr; nz = rng.standard_normal(len(t)); y = np.zeros_like(nz); s = 0
        for k in range(len(t)):
            s += (0.02 + 0.5 * (k / len(t)) ** 2) * (nz[k] - s); y[k] = s
        return y * np.sin(np.pi * np.linspace(0, 1, len(t))) ** 1.5 * 2.2
    def thud(L=0.45):
        t = np.arange(int(sr * L)) / sr; f = 110 * np.exp(-t * 9) + 45
        return np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t * 9) * 1.1 + rng.standard_normal(len(t)) * np.exp(-t * 60) * 0.5
    for k in range(cycles):
        t0 = k * CYCLE; add(whoosh(), t0 + 0.38); add(thud() * (1 - 0.04 * (k % 4)), t0 + 0.62)
    out = out / np.max(np.abs(out)) * 0.9; out[-200:] *= np.linspace(1, 0, 200)
    raw = path + ".1x.wav"
    with wave.open(raw, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((out * 32767).astype("<i2").tobytes())
    chain, rem = [], speed
    while rem > 2.0: chain.append("atempo=2.0"); rem /= 2.0
    chain.append(f"atempo={rem:.4f}")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af", ",".join(chain), path], check=True)
    os.remove(raw)


HTML = """<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=1080, height=1920" />
<title>Cat Punch Loop</title>
<script src="assets/gsap.min.js"></script>
<style>
body{margin:0;background:#fff}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#fff}
#bg{position:absolute;left:0;top:0;width:1080px;height:1920px;background:#fff}
#stage,#body,#punch{position:absolute;left:0;top:0;width:1080px;height:1920px}
.layer{position:absolute;left:0;top:@TOP@px;width:1080px;height:@IMGH@px;display:block}
#img-body{mix-blend-mode:multiply}
#punch{transform-origin:@OX@px @OY@px}
</style></head><body>
<div id="root" data-composition-id="main" data-width="1080" data-height="1920" data-duration="@DUR@">
<div id="bg"></div>
<div id="stage">
 <div id="body"><img id="img-body" class="layer" src="assets/cat_body.png" /></div>
 <div id="punch"><img id="img-paw" class="layer" src="assets/paw.png" /><img id="img-blur" class="layer" src="assets/paw_blur.png" style="opacity:0" /></div>
</div>
<audio id="sfx" src="assets/sfx.wav" data-start="0" data-duration="@DUR@" data-track-index="10" data-volume="1"></audio>
</div>
<script>
window.__timelines=window.__timelines||{};
const tl=gsap.timeline({paused:true});
const SP=@SPEED@, f=(x)=>x/SP, CYCLE=@CYCLE@, N=@N@, ZOOM=@ZOOM@, TX=@TX@, TY=@TY@;
const shake=[[-30,20],[34,-24],[-20,-16],[16,22],[-9,7],[0,0]];
const FT=(sel,a,b,d,e,at)=>tl.fromTo(sel,a,Object.assign({duration:f(d),ease:e,immediateRender:false},b),f(at));
for(let k=0;k<N;k++){const t=k*CYCLE;
 FT("#stage",{y:0},{y:-8},0.22,"sine.inOut",t);
 FT("#stage",{y:-8},{y:0},0.2,"sine.inOut",t+0.22);
 FT("#punch",{scale:1,x:0,y:0},{scale:ZOOM,x:TX,y:TY},0.17,"power4.in",t+0.45);   // ONLY the fist layer zooms
 FT("#img-blur",{opacity:0},{opacity:1},0.1,"none",t+0.52);
 shake.forEach((s,i)=>tl.set("#stage",{x:s[0],y:s[1]},f(t+0.62+i*0.018)));
 FT("#punch",{scale:ZOOM,x:TX,y:TY},{scale:1,x:0,y:0},0.38,"expo.out",t+0.74);
 FT("#img-blur",{opacity:1},{opacity:0},0.15,"none",t+0.74);
}
window.__timelines["main"]=tl;
</script></body></html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True); ap.add_argument("--project", default="cat-punch-loop")
    ap.add_argument("--paw-box", required=True, help="x0,y0,x1,y1 box around the fist (image px)")
    ap.add_argument("--paw-center", required=True, help="cx,cy fist centre (image px)")
    ap.add_argument("--cut", default=None, help="x1,y1,x2,y2 line; fur above it is removed from the fist mask")
    ap.add_argument("--speed", type=float, default=1.0); ap.add_argument("--duration", type=float, default=5.0)
    ap.add_argument("--render", action="store_true")
    a = ap.parse_args()
    box = tuple(map(int, a.paw_box.split(","))); center = tuple(map(int, a.paw_center.split(",")))
    cut = tuple(map(float, a.cut.split(","))) if a.cut else None
    hf = os.path.join("projects", a.project, "hyperframes"); os.makedirs(os.path.join(hf, "assets"), exist_ok=True)
    os.makedirs(os.path.join("projects", a.project, "renders"), exist_ok=True)
    W, H, px = make_layers(a.image, hf, box, center, cut)
    k = 1080 / W; imgh = H * k; top = (1920 - imgh) / 2
    ox, oy = center[0] * k, top + center[1] * k
    pw, ph = (box[2] - box[0]) * k * 0.8, (box[3] - box[1]) * k * 0.8      # box overestimates the fist a bit
    zoom = round(1.3 * max(1080 / pw, 1920 / ph) * 0.8 / 0.8, 2)
    cycles = math.ceil(a.duration * a.speed / CYCLE)
    make_sfx(os.path.join(hf, "assets", "sfx.wav"), cycles, a.speed)
    shutil.copy(os.path.join(HERE, "gsap.min.js"), os.path.join(hf, "assets", "gsap.min.js"))  # no CDN: sandbox blocks it
    html = HTML
    for key, val in {"@TOP@": top, "@IMGH@": imgh, "@OX@": round(ox, 1), "@OY@": round(oy, 1), "@DUR@": a.duration,
                     "@SPEED@": a.speed, "@CYCLE@": CYCLE, "@N@": cycles, "@ZOOM@": zoom,
                     "@TX@": round(540 - ox), "@TY@": round(960 - oy)}.items():
        html = html.replace(key, str(val))
    open(os.path.join(hf, "index.html"), "w").write(html)
    print(f"paw mask px={px} zoom={zoom} cycles={cycles} -> {hf}")
    if a.render:
        out = os.path.abspath(os.path.join("projects", a.project, "renders", f"final_{a.speed:g}x_{a.duration:g}s.mp4"))
        fps = "60" if a.speed > 1 else "30"
        subprocess.run(["npx", "hyperframes", "validate"], cwd=hf, check=True)
        subprocess.run(["npx", "hyperframes", "render", "--quality", "standard", "--fps", fps, "--output", out], cwd=hf, check=True)
        print("rendered", out)


if __name__ == "__main__":
    main()
