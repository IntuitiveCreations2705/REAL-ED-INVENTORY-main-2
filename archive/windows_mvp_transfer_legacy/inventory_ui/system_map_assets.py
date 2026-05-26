from __future__ import annotations

import hashlib
import importlib
import json
import base64
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    _pil_image = importlib.import_module("PIL.Image")
    _pil_draw = importlib.import_module("PIL.ImageDraw")
    _pil_font = importlib.import_module("PIL.ImageFont")
    Image = _pil_image
    ImageDraw = _pil_draw
    ImageFont = _pil_font
except Exception:  # pragma: no cover - handled at runtime if Pillow missing
    Image = None
    ImageDraw = None
    ImageFont = None

ROOT = Path(__file__).resolve().parents[2]
UI_DIR = ROOT / "inventory_app" / "ui"
SOURCE_FILE = UI_DIR / "SYSTEM_MAP.md"
PNG_FILE = UI_DIR / "static" / "system_map_latest.png"
MANIFEST_FILE = UI_DIR / "static" / "system_map_manifest.json"


@dataclass(frozen=True)
class Node:
    key: str
    label: str
    x: int
    y: int
    w: int
    h: int


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _line_center(node: Node, side: str) -> tuple[int, int]:
    if side == "right":
        return node.x + node.w, node.y + node.h // 2
    if side == "left":
        return node.x, node.y + node.h // 2
    if side == "top":
        return node.x + node.w // 2, node.y
    return node.x + node.w // 2, node.y + node.h


def _draw_arrow(draw: Any, p1: tuple[int, int], p2: tuple[int, int], color: str = "#7fa8ff") -> None:
    draw.line([p1, p2], fill=color, width=3)
    x2, y2 = p2
    x1, y1 = p1
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return
    mag = (dx * dx + dy * dy) ** 0.5
    ux, uy = dx / mag, dy / mag
    left = (x2 - int(12 * ux - 6 * uy), y2 - int(12 * uy + 6 * ux))
    right = (x2 - int(12 * ux + 6 * uy), y2 - int(12 * uy - 6 * ux))
    draw.polygon([p2, left, right], fill=color)


def _draw_node(draw: Any, node: Node, *, fill: str = "#1a2446", border: str = "#304379", text: str = "#eaf0ff") -> None:
    r = 18
    draw.rounded_rectangle((node.x, node.y, node.x + node.w, node.y + node.h), radius=r, fill=fill, outline=border, width=2)
    font = ImageFont.load_default()
    lines = node.label.split("\n")
    y = node.y + 10
    for ln in lines:
        bbox = draw.textbbox((0, 0), ln, font=font)
        tw = bbox[2] - bbox[0]
        draw.text((node.x + (node.w - tw) // 2, y), ln, fill=text, font=font)
        y += 16


def _generate_png() -> None:
    if Image is None:
        _generate_fallback_png()
        return

    PNG_FILE.parent.mkdir(parents=True, exist_ok=True)

    width, height = 1800, 1080
    img = Image.new("RGB", (width, height), "#0b1020")
    draw = ImageDraw.Draw(img)

    title_font = ImageFont.load_default()
    draw.text((40, 24), "Inventory System Map (Generated)", fill="#eaf0ff", font=title_font)
    draw.text((40, 46), "Backend ↔ Satellites visual reference", fill="#aab4da", font=title_font)

    nodes: dict[str, Node] = {
        "user": Node("user", "Admin User", 60, 180, 170, 70),
        "master": Node("master", "Satellite A\nMaster UI", 280, 120, 220, 90),
        "item": Node("item", "Satellite B\nItem List UI", 280, 250, 220, 90),
        "api": Node("api", "Flask Backend\napp.py", 600, 170, 240, 100),
        "dbmod": Node("dbmod", "DB Layer\ndb.py", 940, 110, 210, 80),
        "audit": Node("audit", "Audit Writer\naudit.py", 940, 230, 210, 80),
        "db": Node("db", "SQLite\nsql_inventory_master.db", 1240, 170, 280, 110),
        "migrate": Node("migrate", "migrate.py +\nSQL migrations", 600, 350, 240, 100),
    }

    for n in nodes.values():
        _draw_node(draw, n)

    for name, y in [
        ("master_inventory", 420),
        ("item_id_list", 470),
        ("event_name", 520),
        ("audit_log", 570),
        ("users/roles", 620),
    ]:
        n = Node(name, name, 1240, y, 280, 42)
        _draw_node(draw, n, fill="#111a33", border="#2c3e76")
        _draw_arrow(draw, _line_center(nodes["db"], "bottom"), _line_center(n, "top"), color="#5e85df")

    _draw_arrow(draw, _line_center(nodes["user"], "right"), _line_center(nodes["master"], "left"))
    _draw_arrow(draw, _line_center(nodes["user"], "right"), _line_center(nodes["item"], "left"))
    _draw_arrow(draw, _line_center(nodes["master"], "right"), _line_center(nodes["api"], "left"))
    _draw_arrow(draw, _line_center(nodes["item"], "right"), _line_center(nodes["api"], "left"))
    _draw_arrow(draw, _line_center(nodes["api"], "right"), _line_center(nodes["dbmod"], "left"))
    _draw_arrow(draw, _line_center(nodes["api"], "right"), _line_center(nodes["audit"], "left"))
    _draw_arrow(draw, _line_center(nodes["dbmod"], "right"), _line_center(nodes["db"], "left"))
    _draw_arrow(draw, _line_center(nodes["audit"], "right"), _line_center(nodes["db"], "left"))
    _draw_arrow(draw, _line_center(nodes["migrate"], "right"), _line_center(nodes["db"], "bottom"), color="#6fdd8a")

    draw.text((40, 980), "Generated from SYSTEM_MAP.md hash. Use /api/system-map for current source metadata.", fill="#9cb0e6", font=title_font)

    img.save(PNG_FILE, format="PNG")


def _generate_fallback_png() -> None:
    """Write a tiny valid PNG so UI never 404s when Pillow is unavailable."""
    PNG_FILE.parent.mkdir(parents=True, exist_ok=True)
    # 1x1 opaque dark pixel PNG
    tiny_png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAwUB"
        "AO9v9ZQAAAAASUVORK5CYII="
    )
    PNG_FILE.write_bytes(base64.b64decode(tiny_png_b64))


def _write_manifest(source_hash: str) -> dict[str, Any]:
    rel_ui = Path("inventory_app") / "ui"
    renderer = "pillow" if Image is not None else "fallback-png"
    payload: dict[str, Any] = {
        "source_file": str(rel_ui / "SYSTEM_MAP.md"),
        "generated_at": _now_iso(),
        "source_hash": source_hash,
        "png_path": str(rel_ui / "static" / "system_map_latest.png"),
        "renderer": renderer,
        "manifest_version": 1,
    }
    MANIFEST_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def ensure_system_map_assets() -> dict[str, Any]:
    """Ensure the system map PNG + manifest exist and match SYSTEM_MAP.md hash."""
    if not SOURCE_FILE.exists():
        raise FileNotFoundError(f"Missing source map file: {SOURCE_FILE}")

    source_hash = _sha256(SOURCE_FILE)
    regenerate = not PNG_FILE.exists() or not MANIFEST_FILE.exists()
    manifest: dict[str, Any] = {}

    if MANIFEST_FILE.exists():
        try:
            manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
            if manifest.get("source_hash") != source_hash:
                regenerate = True
        except Exception:
            regenerate = True

    if regenerate:
        _generate_png()
        manifest = _write_manifest(source_hash)

    if not manifest and MANIFEST_FILE.exists():
        manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))

    return manifest
