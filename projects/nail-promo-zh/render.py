"""Render driver: builds props from a texts_<lang>.json and calls video_compose (atelier/Remotion).

usage: python projects/nail-promo-zh/render.py <lang> <A|B> <output.mp4> [--draft]
       python projects/nail-promo-zh/render.py zh A projects/nail-promo-zh/output/美甲推广_中文版_A.mp4
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.tool_registry import registry  # noqa: E402

PROJ = Path(__file__).resolve().parent
lang, variant, out = sys.argv[1], sys.argv[2], sys.argv[3]
draft = "--draft" in sys.argv

texts = json.loads((PROJ / f"texts_{lang}.json").read_text(encoding="utf-8"))
props_path = PROJ / "artifacts" / "props" / f"props_{lang}_{variant}.json"
props_path.parent.mkdir(parents=True, exist_ok=True)
props_path.write_text(json.dumps({"variant": variant, "texts": texts}, ensure_ascii=False), encoding="utf-8")

edit = json.loads((PROJ / "artifacts" / "edit_decisions.json").read_text(encoding="utf-8"))
edit["bespoke"] = {
    **edit.get("bespoke", {}),
    "entry": str(PROJ / "composition" / "index.tsx"),
    "composition_id": "NailPromo",
    "props_path": str(props_path),
    "public_dir": str(PROJ / "public"),
    "crf": 23 if draft else 16,
    **({"scale": 0.5} if draft else {}),
}
registry.discover()
vc = registry._tools["video_compose"]
r = vc.execute({
    "operation": "render",
    "edit_decisions": edit,
    "output_path": str(Path(out).resolve()),
    "remotion_browser_executable": "/opt/pw-browsers/chromium",
})
print("success:", r.success)
print("error:", r.error)
print(json.dumps(r.data, ensure_ascii=False, indent=1, default=str)[:3000] if r.data else "")
