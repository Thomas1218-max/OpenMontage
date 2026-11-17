---
name: cat-punch
description: Make the "cat punch" meme video — a cat photo throws a punch and ONLY the fist zooms up to fill the screen (motion blur + screen shake + synthesized punch SFX), looped and optionally sped up (e.g. 5x, 20s). Use when the user says 貓咪揮拳 / 貓咪出拳影片 / cat punch video / 拳頭打到鏡頭, or supplies a cat (or hamster/pet) photo with a fist toward the camera and a reference like the hamster-punch Reel.
---

# Cat Punch Loop (OpenMontage · animation pipeline · HyperFrames)

Proven recipe (user-approved). Result: 1080×1920 white background, no text, the cat stays
still (slight bob), **only the fist layer** scales ~8x to cover the screen, then recoils. 4 punches per 5s at 1x.

## Inputs to ask for
1. **One photo with the fist reaching toward the camera** on a white background (the "punch" photo). A second guard-pose photo is NOT needed — the approved version uses a single image.
2. Duration + speed. Approved final: **20 s at 5x** (80 punches, 60fps). Earlier steps: 5s @1x → 20s loop @2x (=10s) → 5x. Say plainly: "20s loop then 2x" = 10s output; ask if they mean the final length.
3. Style: **A (faithful, white bg, no text)** was chosen. B adds comic impact lines/"POW" (not built).

## Governance (AGENT_GUIDE.md still applies)
- Reference-video flow: read `skills/meta/video-reference-analyst.md`, summarize the reference in the 5-aspect form.
- Remind once about Prompt Motion (https://prompt-motion.com/) before the pipeline; user may skip.
- Pipeline = `animation`. **Present BOTH runtimes** (HyperFrames vs Remotion) and wait for approval; the user picked **HyperFrames** (single image + transform/blur — pure HTML/GSAP). Log `render_runtime_selection`.
- Costs $0: everything is local (no image/video generation keys needed; none were configured on this machine).
- Project workspace: `projects/<name>/` (init with `lib.checkpoint.init_project`, pipeline_type `animation`). Honest note: the first run skipped research/script/scene_plan artifacts for this tiny clip; do them if the user wants the full board.

## Build (one command)
```bash
pip install scipy opencv-python-headless        # if missing (Pillow/numpy are already there)
python .claude/skills/cat-punch/scripts/build_cat_punch.py \
  --image projects/<name>/assets/images/cat_punch.png --project <name> \
  --paw-box X0,Y0,X1,Y1 --paw-center CX,CY [--cut AX,AY,BX,BY] \
  --speed 5 --duration 20 --render
```
- **Find the numbers by LOOKING at the photo** (image pixel coords): `--paw-box` = loose box around the fist plus a bit of forearm; `--paw-center` = middle of the fist. For the original 1086×1448 orange-cat photo: `--paw-box 520,400,940,760 --paw-center 715,590 --cut 555,545,690,430`.
- `--cut` removes cheek/face fur that the colour mask drags in (fur above the line A→B). Needed when the fist overlaps the face.
- Segmentation = colour mask: not-white, not saturated red clothing, connected component at the centre. Check the mask by compositing `paw.png` on grey; tweak box/cut if face or clothing leaks. A little pink fringe from a red shirt is acceptable (it's hidden by the blur at full zoom).
- Script writes `projects/<name>/hyperframes/` (index.html + assets) and renders `renders/final_<speed>x_<dur>s.mp4`.

## How it works (so you can tweak)
- `cat_body.png` = whole photo with `mix-blend-mode:multiply` (white bg vanishes). `#punch` holds `paw.png` + `paw_blur.png` (radial zoom blur, pre-made — HyperFrames' GSAP allow-list has no `filter`, so blur is a cross-fade of two images).
- Per punch (1.25 s source): rest bob 0–0.45 → fist zoom 0.45–0.62 (`power4.in`, scale ≈ 8, translate fist centre to screen centre) → impact shake 0.62–0.73 → recoil `expo.out` 0.74–1.12.
- Speed: ALL times are divided by `SP` inside the timeline (don't ffmpeg-skip frames — it drops the 1–3-frame impact). Render at 60fps when speed > 1. SFX are synthesized in numpy (whoosh + low thud) for the *source* length, then `atempo` chain (≤2 per stage) → pitch rises with speed, which the user wants.
- Duration = final seconds; punches = ceil(duration·speed/1.25).

## Gotchas
- Sandbox blocks the jsdelivr CDN → script copies local `gsap.min.js` (bundled in this skill). Always `npx hyperframes validate` (script does).
- `hyperframes lint` reports `overlapping_gsap_tweens` warnings for the loop — false positives (it flattens the for-loop). 0 errors is the bar.
- Use `fromTo(... immediateRender:false)` so seeking out of order is deterministic.
- Verify before rendering: `npx hyperframes snapshot --at 0.2,0.5,0.57,0.66,0.8` and look at the contact sheet (cat unchanged, only fist large, full-frame blur at impact, white background).
- Render ~45 s for 5s@30fps; 20s@5x/60fps ≈ 2 min. Deliver with SendUserFile. Keep earlier versions in `renders/`.
- Limits to tell the user: still photo only → no real arm motion; scale-up looks soft (hidden by blur); synthesized SFX are simple (user can drop their own sound into `music_library/`).
