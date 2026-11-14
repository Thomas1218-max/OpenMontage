---
name: nail-promo
description: Make a nail-salon promo short video (美甲视频 / 美甲推广视频 / 美甲短视频 / video nail / video quảng cáo tiệm nail) from the user's own phone footage and photos — 9:16 TikTok/Reels, no voiceover, Chinese + Vietnamese on-screen text, A/B hook versions and a cover image. Use whenever the user mentions 美甲视频 or asks for a nail / manicure promo, ad, reel or TikTok, even briefly ("再做一支美甲视频", "nail video for the shop").
---

# Nail salon promo video (美甲视频)

A proven workflow from the first production for **Nail room 1:1** (Nov 2026). It turns the owner's own clips and photos into a
soft-luxe 25–28s vertical promo with music, sound effects and on-screen text, and needs **no paid API**.
Everything reusable is in `template/`. Copy it and change the data, not the code.

The user writes in Chinese (简体). Reply in Chinese. Vietnamese copy must be confirmed by the user before rendering (see step 6).

## What the finished product looks like

**Look.** Cream `#FBF6F1`, nude pink `#E9C9C1` and a champagne-gold gradient. Bold sans type in white with a soft cocoa shadow.
Any text wrapped in `{{ }}` is drawn in gold, and the price is always gold.

**Signature device.** Four-point sparkle glints twinkle on the nails, and a sparkle burst plus white flash fires on every photo cut.

**Badge.** A red, slanted, gently pulsing「⏰ 限时优惠 / Ưu đãi có hạn」badge sits top-right from shot 2 to the end.

**Shot structure.** Default lengths, every cut on a music beat:

| # | Shot | Default source | Treatment |
|---|---|---|---|
| 1 | Hook ~3.3s | best "finished nails rotating" clip | frame 0 already shows nails + big text; zoom 100→110%; sparkles; 「叮」 at 2.8s |
| 2 | Price ~2.6s | hero photo | blur→sharp; 130K **stamp** (3.2×→1× + shake) with 「咚」 on landing; sub-line 「≈ 奶茶+午餐」 |
| 3 | Process ~4.5s | brush close-up @0.9x | slow push-in toward the brush tip, 2 captions |
| 4 | Swatches ~2.6s | colour-chart pan | soft-light edge glow, 1 caption |
| 5 | Gel wall ~3.9s | polish shelf @1.5x | caption; ends with fast push-in + blur + white flash |
| 6 | Portfolio 5×2 beats | 5 finished photos | Ken Burns, flash + sparkle per cut, bottom-left label 「N 号｜款式」, top bar 「每一款都是 130K」, 「先截图存起来 📌」 |
| 7 | CTA ~4.5s | end of hook clip, freeze + blur | cream glass card slides up: tag, 全套 130K ₫, includes, urgency, address, hours, Zalo; last ~1.3s 「喜欢几号？评论区告诉我 💅」 + sparkle burst |

**Spec.** The safe area leaves 250px clear at the top and bottom and 150px on the right; centred text uses the x=150..930 column.
Source audio is muted. Music is loudness-normalised to −14 LUFS.

**Deliverables.** For each language: `<name>_A.mp4` (suspense hook) and `<name>_B.mp4` (price-contrast hook) in H.264, 1080×1920, 30fps,
`yuv420p` + faststart. Plus `cover.jpg` (1080×1920): hero photo, big gold 「130K 做一整副？！」 in the top third, red tag and a sub-line.

## Shop facts (defaults — confirm price/promo each time)

- Name: **Nail room 1:1** · 📍 86 Phan Văn Hùm, Q12, TP.HCM · ⏰ 9:00 营业到晚上 · 💬 Zalo 私讯预约
- Promo used last time: 全套 130K ₫, 含：延长 / 猫眼或果冻底 / 造型设计. **Ask whether the price and promo are still the same.**
- The user-approved texts are in `template/texts_zh.json` and `template/texts_vi.json`. Start from them.
- User-corrected Vietnamese style names (keep this spelling): Chrome mắt mèo · Tráng gương xà cừ · French xanh mint tráng gương ·
  Thạch gạo đính đá · Mắt mèo nơ tiểu thư.

## Workflow

Follow `AGENT_GUIDE.md` (read it first, as `CLAUDE.md` requires). This skill is the approved recipe for the `hybrid` pipeline with
`render_runtime: remotion` and `composition_mode: atelier`. Do the Prompt Motion reminder in one line, then continue.
Gates: show the storyboard + cover preview and **wait for approval** before the final export.

1. **Set up the project.** Pick a kebab-case `<slug>`, then:
   ```bash
   python -c "from lib.checkpoint import init_project; init_project('<slug>', title='<title>', pipeline_type='hybrid')"
   cp -r .claude/skills/nail-promo/template/. projects/<slug>/
   mkdir -p projects/<slug>/artifacts && cp projects/<slug>/edit_decisions.json projects/<slug>/artifacts/
   cd projects/<slug> && unzip -o <uploaded.zip>     # zip contains assets/…; otherwise copy files into assets/
   ```
   If `fc-list | grep "Noto Sans CJK"` is empty, run `apt-get install -y fonts-noto-cjk`. If librosa is missing, run `pip install librosa`.

2. **Look at the footage before choosing cuts.** Build a contact sheet per clip and actually view it:
   `ffmpeg -i assets/X.mp4 -vf "fps=2,scale=216:384,tile=9x2" -frames:v 1 /tmp/X.jpg`.
   - Check that phone-video rotation comes out upright and 1080×1920.
   - Find the seconds where all 5 nails are visible, and note moments where the hand hides the nails.
   - Photos with black letterbox bars are cropped automatically by `prep_media.py`.
   - Do not use screenshots.

3. **Music.** It must be royalty-free, with no vocals: lo-fi / chill pop.
   - Use the registry tool `pixabay_music`, which needs no key. Always pass `output_path` under `projects/<slug>/assets/music/`.
     Fetch 3–4 candidates.
   - `python -I scripts/analyze_music.py assets/music/<track>.mp3` prints tempo and energy per bar. Choose a start so that a
     quiet bar → loud bar change (the "drop") lands on shot 6.
   - Snap the timeline to that start, for example:
     `python -I scripts/analyze_music.py <track> --start <sec> --beats 5,4,7,4,6 --photos 5 --photo-beats 2 --cta-beats 7`.
     Paste the JSON into `promo.json` → `timeline`, and set `music.start` to the snapped start. Keep `END` ≤ 840 (28s).
     Trim `END`/`OUTRO` a few frames if needed. Keep `S7 − S6 = photos × PHOTO`.
   - Move the sfx times with the timeline: ding = 2.8s; dong = (S2 + 9) / 30 (the stamp landing); shimmer = OUTRO / 30.
   - Tell the user which track you picked and why, and say that you can't hear audio. They will judge the music from the preview.
     Last time the user preferred **lofi pop** ("Lofi Pop" by ZephiraMusic, ~92 BPM).

4. **Fill in `promo.json`.**
   - `clips` holds the source start, duration (source seconds) and speed for `hook/paint/swatch/wall/end`. Output length is
     `dur / speed`, and it must be ≥ the shot length.
   - `photos` lists the photo files.
   - `price_photo` / `cover_photo` name the public file, e.g. `IMG_3599.jpg`.
   - Then run `python -I scripts/prep_media.py`. It builds `public/`: clips, cleaned photos plus `media.json` aspects, fonts,
     synthesized SFX and the mixed `soundtrack.wav`.

5. **Write the text.** Edit `texts_zh.json`:
   - `hook.A` / `hook.B`: keep each line ≤ 15 characters.
   - `portfolio.items` holds the image + 「N 号」 + style name for each photo. Ask the user for style names if unsure.
   - `\n` forces a line break and `{{ }}` makes text gold.
   - `sizes` (optional) overrides font px per key: hook, price_lead, process, swatches, gel_wall[], portfolio_top, save_hint,
     label_no, label_name, cta_small, cta_headline_pre, cta_info, outro, cover_headline[], cover_sub, tag.

6. **Preview gate.**
   ```bash
   python scripts/render.py zh A renders/preview_A.mp4 --draft       # ~2 min at half scale (use full scale to send to user)
   python scripts/storyboard.py zh renders/preview_A.mp4 renders/storyboard.jpg
   python scripts/cover.py zh renders/cover_preview.jpg
   ```
   View the storyboard yourself first. Check for text colliding with the red badge, 3-line wraps, text over the nails, and gold
   text with low contrast. Fix by adjusting `sizes` or line breaks. Then send the storyboard, cover and preview with `SendUserFile`,
   list your judgement calls, and **end the turn**.

7. **Final export** (after approval):
   ```bash
   python scripts/render.py zh A "output/美甲推广_中文版_A.mp4"
   python scripts/render.py zh B "output/美甲推广_中文版_B.mp4"
   python scripts/cover.py zh output/cover.jpg
   ```
   `render.py` goes through OpenMontage `video_compose` (atelier) and converts the result to `yuv420p` + faststart.
   Verify the output with ffprobe and a frame sheet, then send the files.

8. **Vietnamese version.** `texts_vi.json` already has `font_faces` (Be Vietnam Pro, SIL OFL, in `fonts/`) and tuned `sizes`.
   - Translate, and show the user a 中文 ↔ Tiếng Việt table of the new or changed lines **before rendering**. The user corrects
     style names.
   - Write money as `130K`, and convert 万 to K: 50 万 → 500K.
   - Number labels are 「Mẫu N」.
   - Export `output/美甲推广_越南文版_{A,B}.mp4` + `output/cover_vi.jpg`.

9. **Commit the project source.** `projects/` is git-ignored, so force-add only the small files: texts, promo.json, composition,
   artifacts. Never add media.

## Gotchas (learned the hard way)

- **Remotion's Chrome download fails** (`remotion.media` is blocked). Always pass `--browser-executable=/opt/pw-browsers/chromium`.
  The scripts already do this.
- **The atelier entry must be staged** under `remotion-composer/projects/<slug>/`. `video_compose` does this for renders and
  `_common.stage_composition()` does it for stills. After editing `.tsx`, re-run a script; don't edit the staged copy.
- **ffmpeg trims:** put `-ss/-t` *before* `-i` to cut source time. `-t` after `-i` with `setpts` cuts output time and gives the
  wrong length.
- **Pixel format:** Remotion outputs full-range `yuvj420p`, so always finalize to `yuv420p` (`render.py` does this).
- **Font for Chinese:** Noto Sans CJK comes from the system font install. Vietnamese needs Be Vietnam Pro for clean diacritics,
  loaded through `texts.font_faces`.
- **Gold text over a light hand** loses contrast. The gold filter carries a dark hairline outline; keep it.
- **Text near the badge:** the badge occupies roughly x 690–930, y 260–340. Captions start at y ≈ 410 and the price block at 372.
  A wider (Vietnamese) badge needs `sizes.tag` ≈ 32.
- **Shot 7 needs enough clip:** the hook clip's last ~1.7s at 0.8x + `freeze` covers it.
- **Cover:** keep text in the top third (y 250–800) and place the photo at top ≈ 590 so the nails stay clear.
