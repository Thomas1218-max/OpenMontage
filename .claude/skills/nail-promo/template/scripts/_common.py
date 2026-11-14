"""Shared paths/helpers for the nail-promo template scripts. PROJ = the project dir (parent of scripts/)."""
import json, shutil, subprocess
from pathlib import Path

PROJ = Path(__file__).resolve().parents[1]
ROOT = next(p for p in PROJ.parents if (p / "remotion-composer").is_dir())  # OpenMontage repo root
COMPOSER = ROOT / "remotion-composer"
CHROMIUM = "/opt/pw-browsers/chromium"  # Remotion cannot download its own Chrome here (remotion.media blocked)


def load_promo():
    return json.loads((PROJ / "promo.json").read_text(encoding="utf-8"))


def build_props(lang: str, variant: str) -> Path:
    """Merge texts_<lang>.json + promo.json timeline + photo aspects into one --props file."""
    promo = load_promo()
    texts = json.loads((PROJ / f"texts_{lang}.json").read_text(encoding="utf-8"))
    media = PROJ / "public" / "media.json"
    aspects = json.loads(media.read_text()) if media.exists() else {}
    props = {
        "variant": variant,
        "texts": texts,
        "timeline": promo["timeline"],
        "aspects": aspects,
        "price_photo": promo["price_photo"],
        "cover_photo": promo["cover_photo"],
    }
    out = PROJ / "artifacts" / "props" / f"props_{lang}_{variant}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
    return out


def stage_composition() -> Path:
    """Copy composition/*.tsx under remotion-composer/projects/<slug>/ so webpack finds node_modules."""
    dst = COMPOSER / "projects" / PROJ.name
    dst.mkdir(parents=True, exist_ok=True)
    for f in (PROJ / "composition").glob("*.tsx"):
        shutil.copy2(f, dst / f.name)
    return dst / "index.tsx"


def remotion_still(comp_id: str, out_png: Path, props: Path, frame: int = 0):
    entry = stage_composition()
    subprocess.run(
        ["npx", "remotion", "still", str(entry.relative_to(COMPOSER)), comp_id, str(out_png),
         f"--frame={frame}", f"--props={props}", f"--public-dir={PROJ / 'public'}",
         f"--browser-executable={CHROMIUM}"],
        cwd=COMPOSER, check=True, stdout=subprocess.DEVNULL)


def finalize_mp4(path: Path):
    """Remotion writes full-range yuvj420p; convert to tv-range yuv420p + faststart for TikTok/IG/FB."""
    tmp = path.with_suffix(".tmp.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path),
                    "-vf", "scale=in_range=full:out_range=tv,format=yuv420p",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high",
                    "-movflags", "+faststart", "-color_range", "tv", "-c:a", "copy", str(tmp)], check=True)
    tmp.replace(path)
