"""Render one language/variant through OpenMontage video_compose (Remotion, atelier mode), then finalize.

usage: python projects/<slug>/scripts/render.py <lang> <A|B> <out.mp4> [--draft]
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import PROJ, ROOT, CHROMIUM, build_props, finalize_mp4  # noqa: E402
sys.path.insert(0, str(ROOT))
from tools.tool_registry import registry  # noqa: E402

lang, variant, out = sys.argv[1], sys.argv[2], Path(sys.argv[3]).resolve()
draft = "--draft" in sys.argv
props = build_props(lang, variant)
edit = json.loads((PROJ / "artifacts" / "edit_decisions.json").read_text(encoding="utf-8"))
edit["bespoke"] = {**edit.get("bespoke", {}), "entry": str(PROJ / "composition" / "index.tsx"),
                   "composition_id": "NailPromo", "props_path": str(props), "public_dir": str(PROJ / "public"),
                   "crf": 23 if draft else 16, **({"scale": 0.5} if draft else {})}
registry.discover()
r = registry._tools["video_compose"].execute({"operation": "render", "edit_decisions": edit, "output_path": str(out),
                                              "remotion_browser_executable": CHROMIUM})
print("success:", r.success, "| error:", r.error)
if r.success and not draft:
    finalize_mp4(out)
    print("finalized:", out)
review_dir = out.parent / ".final_review_frames"
if review_dir.exists():
    import shutil; shutil.rmtree(review_dir)
