from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".avif"}
AUDIO_EXTENSIONS = {".mp3", ".ogg", ".wav", ".flac", ".m4a", ".aac"}


def path_for_json(path: Path) -> str:
    return "/" + path.as_posix()


def make_id(value: str, fallback: str) -> str:
    normalized = value.strip().lower()
    normalized = re.sub(r"\s+", "-", normalized)
    normalized = re.sub(r"[^0-9a-zA-Z\u3040-\u30ff\u3400-\u9fff-]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized or fallback


def sorted_files(path: Path) -> list[Path]:
    if not path.exists() or not path.is_dir():
        return []
    return sorted((item for item in path.iterdir() if item.is_file()), key=lambda item: item.name.lower())


def first_existing_dir(paths: Iterable[Path]) -> Path | None:
    for path in paths:
        if path.exists() and path.is_dir():
            return path
    return None


def find_optional_asset(game_dir: Path, names: Iterable[str]) -> Path | None:
    lookup = {item.name.lower(): item for item in sorted_files(game_dir)}
    for name in names:
        asset = lookup.get(name.lower())
        if asset:
            return asset
    return None


def first_image(path: Path) -> Path | None:
    return next((item for item in sorted_files(path) if item.suffix.lower() in IMAGE_EXTENSIONS), None)


def read_game_meta(game_dir: Path) -> dict[str, object]:
    meta_path = game_dir / "game.json"
    if not meta_path.exists():
        return {}
    with meta_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def read_optional_json(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return data if isinstance(data, dict) else {}


def read_optional_json_list(path: Path) -> list[object]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return data if isinstance(data, list) else []


def read_cover_source(path: Path) -> str:
    data = read_optional_json(path)
    return str(data.get("src") or data.get("cover") or "").strip()


def normalize_key(value: object) -> str:
    text = str(value).lower().replace("　", " ")
    for char in "～〜~-‐‑‒–—―：:/／＊*＋+!！？?「」『』“”'\" ":
        text = text.replace(char, "")
    return re.sub(r"\s+", "", text)


def build_cgs(game_dir: Path) -> list[dict[str, str]]:
    cg_dir = game_dir / "cg"
    cg_data = read_optional_json(cg_dir / "cg.json")
    json_images = cg_data.get("images")
    if isinstance(json_images, list) and any(
        (isinstance(item, str) and item) or (isinstance(item, dict) and item.get("src")) for item in json_images
    ):
        cgs = []
        valid_images = [
            item
            for item in json_images
            if (isinstance(item, str) and item) or (isinstance(item, dict) and item.get("src"))
        ]
        for index, item in enumerate(valid_images, start=1):
            if isinstance(item, str):
                cgs.append(
                    {
                        "id": f"cg-{index:03d}",
                        "title": f"CG {index:03d}",
                        "image": item,
                    }
                )
                continue

            cgs.append(
                {
                    "id": str(item.get("id") or f"cg-{index:03d}"),
                    "title": str(item.get("name") or item.get("title") or f"CG {index:03d}"),
                    "image": str(item["src"]),
                }
            )
        return cgs

    cg_files = [item for item in sorted_files(cg_dir) if item.suffix.lower() in IMAGE_EXTENSIONS]

    cgs = []
    for index, item in enumerate(cg_files, start=1):
        cg_id = f"cg-{index:03d}"
        cgs.append(
            {
                "id": cg_id,
                "title": item.stem,
                "image": path_for_json(item),
            }
        )
    return cgs


def build_bgms(game_dir: Path, fallback_cover: str) -> tuple[list[dict[str, object]], str | None, bool]:
    bgm_dir = first_existing_dir((game_dir / "bgm", game_dir / "bgn"))
    if not bgm_dir:
        return [], None, False

    bgm_data = read_optional_json(bgm_dir / "bgm.json")
    files = sorted_files(bgm_dir)
    cover_files = [item for item in files if item.suffix.lower() in IMAGE_EXTENSIONS]
    audio_files = [item for item in files if item.suffix.lower() in AUDIO_EXTENSIONS]
    cover = str(bgm_data.get("cover") or "") or (path_for_json(cover_files[0]) if cover_files else None)
    uses_fallback_cover = False
    if not cover and fallback_cover:
        cover = fallback_cover
        uses_fallback_cover = True

    json_tracks = bgm_data.get("tracks")
    if isinstance(json_tracks, list) and any(item.get("src") for item in json_tracks if isinstance(item, dict)):
        bgms = []
        for index, item in enumerate((item for item in json_tracks if isinstance(item, dict) and item.get("src")), start=1):
            bgm: dict[str, object] = {
                "id": str(item.get("id") or f"bgm-{index:03d}"),
                "title": str(item.get("name") or item.get("title") or f"BGM {index:03d}"),
                "audio": str(item["src"]),
            }
            track_cover = str(item.get("cover") or "") or cover
            if track_cover:
                bgm["cover"] = track_cover
            bgms.append(bgm)
        return bgms, cover, uses_fallback_cover

    bgms: list[dict[str, object]] = []
    for index, item in enumerate(audio_files, start=1):
        bgm_id = f"bgm-{index:03d}"
        bgm: dict[str, object] = {
            "id": bgm_id,
            "title": item.stem,
            "audio": path_for_json(item),
        }
        if cover:
            bgm["cover"] = cover
        bgms.append(bgm)

    return bgms, cover, uses_fallback_cover


def build_unclassified_bgms(game_dir: Path, fallback_cover: str) -> tuple[list[dict[str, object]], str | None, bool]:
    bgm_dir = game_dir / "bgm"
    if not bgm_dir.exists():
        return [], fallback_cover or None, bool(fallback_cover)

    cover = fallback_cover
    bgms: list[dict[str, object]] = []
    seen_titles: set[str] = set()
    seen_sources: set[str] = set()

    song_items = read_optional_json_list(bgm_dir / "song.json")
    for index, item in enumerate((item for item in song_items if isinstance(item, dict) and item.get("url")), start=1):
        title = str(item.get("title") or f"BGM {index:03d}")
        source = str(item["url"])
        seen_titles.add(normalize_key(title))
        seen_sources.add(source)
        track_cover = str(item.get("cover") or "") or cover
        bgm: dict[str, object] = {
            "id": f"bgm-{len(bgms) + 1:03d}",
            "title": title,
            "audio": source,
        }
        if track_cover:
            bgm["cover"] = track_cover
        bgms.append(bgm)

    audio_files = [item for item in sorted_files(bgm_dir) if item.suffix.lower() in AUDIO_EXTENSIONS]
    for item in audio_files:
        title = item.stem
        source = path_for_json(item)
        if normalize_key(title) in seen_titles or source in seen_sources:
            continue
        bgm = {
            "id": f"bgm-{len(bgms) + 1:03d}",
            "title": title,
            "audio": source,
        }
        if cover:
            bgm["cover"] = cover
        bgms.append(bgm)

    return bgms, cover or None, bool(cover)


def build_game(game_dir: Path, fallback_bgm_cover: str) -> tuple[dict[str, object], dict[str, object]]:
    meta = read_game_meta(game_dir)
    game_id = make_id(game_dir.name, f"game-{abs(hash(game_dir.name))}")
    cover = find_optional_asset(game_dir, ("cover.webp", "cover.jpg", "cover.png", "cover.jpeg")) or first_image(game_dir)
    hero = find_optional_asset(game_dir, ("hero.webp", "hero.jpg", "hero.png", "hero.jpeg"))
    cgs = build_cgs(game_dir)
    bgms, bgm_cover, uses_fallback_bgm_cover = build_bgms(game_dir, fallback_bgm_cover)

    game: dict[str, object] = {
        "id": str(meta.get("id") or game_id),
        "title": str(meta.get("title") or game_dir.name),
        "folder": game_dir.name,
        "summary": str(meta.get("summary") or ""),
        "description": str(meta.get("description") or ""),
        "cover": path_for_json(cover) if cover else bgm_cover or "",
        "hero": path_for_json(hero) if hero else "",
        "cg": cgs,
        "bgm": bgms,
    }
    report: dict[str, object] = {
        "id": game["id"],
        "title": game["title"],
        "folder": game["folder"],
        "hasCover": bool(cover),
        "hasSummary": bool(game["summary"] or game["description"]),
        "cgCount": len(cgs),
        "bgmCount": len(bgms),
        "usesFallbackBgmCover": uses_fallback_bgm_cover,
    }
    return game, report


def build_unclassified_game(game_dir: Path, fallback_bgm_cover: str) -> tuple[dict[str, object], dict[str, object]]:
    meta = read_optional_json(game_dir / "未分类.json")
    cover = find_optional_asset(game_dir, ("cover.webp", "cover.jpg", "cover.png", "cover.jpeg")) or first_image(game_dir)
    cover_source = path_for_json(cover) if cover else read_cover_source(game_dir / "cover.json") or fallback_bgm_cover
    bgms, bgm_cover, uses_fallback_bgm_cover = build_unclassified_bgms(game_dir, cover_source)
    title = str(meta.get("name") or "未归档资源池")
    summary = str(meta.get("description") or "暂存暂未确定出处的旧资源。")

    game: dict[str, object] = {
        "id": str(meta.get("id") or "000"),
        "title": title,
        "folder": "000",
        "summary": summary,
        "description": "",
        "cover": cover_source or bgm_cover or "",
        "hero": "",
        "cg": [],
        "bgm": bgms,
        "isUnclassified": True,
    }
    report: dict[str, object] = {
        "id": game["id"],
        "title": game["title"],
        "folder": game["folder"],
        "hasCover": bool(game["cover"]),
        "hasSummary": bool(game["summary"]),
        "cgCount": 0,
        "bgmCount": len(bgms),
        "usesFallbackBgmCover": uses_fallback_bgm_cover,
        "ignoreMissingCg": True,
    }
    return game, report


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def print_report(report: dict[str, object]) -> None:
    totals = report["totals"]
    print(f"Generated {totals['games']} games into {report['outputDir']}")
    print(
        "Data report: "
        f"{totals['withSummary']} with summary, "
        f"{totals['withCover']} with cover, "
        f"{totals['withBgm']} with BGM, "
        f"{totals['withCg']} with CG"
    )

    checks = (
        ("missingSummary", "Missing summary"),
        ("missingCover", "Missing cover"),
        ("missingBgm", "Missing BGM"),
        ("missingCg", "Missing CG"),
        ("fallbackBgmCover", "Using fallback BGM cover"),
    )
    for key, label in checks:
        items = report[key]
        if not items:
            continue
        names = ", ".join(f"{item['id']} {item['title']}" for item in items)
        print(f"{label}: {names}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Generate game JSON metadata from assets/game file names.")
    parser.add_argument("--assets-dir", default="assets/game", help="Directory containing one folder per game.")
    parser.add_argument("--output-dir", default="assets/json", help="Directory for generated JSON files.")
    args = parser.parse_args()

    assets_dir = Path(args.assets_dir)
    output_dir = Path(args.output_dir)
    games_dir = output_dir / "games"

    if not assets_dir.exists():
        raise SystemExit(f"Assets directory not found: {assets_dir}")

    fallback_bgm_cover_path = assets_dir / "000" / "cover.png"
    fallback_bgm_cover = path_for_json(fallback_bgm_cover_path) if fallback_bgm_cover_path.exists() else ""
    if not fallback_bgm_cover:
        fallback_bgm_cover = read_cover_source(assets_dir / "000" / "cover.json")

    game_dirs = sorted(
        (item for item in assets_dir.iterdir() if item.is_dir() and (item / "game.json").exists()),
        key=lambda item: item.name.lower(),
    )
    built_games = [build_game(game_dir, fallback_bgm_cover) for game_dir in game_dirs]
    unclassified_dir = assets_dir / "000"
    if unclassified_dir.exists() and (unclassified_dir / "未分类.json").exists():
        built_games.insert(0, build_unclassified_game(unclassified_dir, fallback_bgm_cover))
    games = [game for game, _report in built_games]
    game_reports = [_report for _game, _report in built_games]

    index = [
        {
            "id": game["id"],
            "title": game["title"],
            "folder": game["folder"],
            "cover": game["cover"],
            "summary": game["summary"],
            "cgCount": len(game["cg"]),
            "bgmCount": len(game["bgm"]),
            "isUnclassified": bool(game.get("isUnclassified")),
        }
        for game in games
    ]

    write_json(output_dir / "games.json", index)
    for game in games:
        write_json(games_dir / f"{game['folder']}.json", game)

    report: dict[str, object] = {
        "outputDir": str(output_dir),
        "totals": {
            "games": len(game_reports),
            "withSummary": sum(1 for item in game_reports if item["hasSummary"]),
            "withCover": sum(1 for item in game_reports if item["hasCover"]),
            "withBgm": sum(1 for item in game_reports if item["bgmCount"]),
            "withCg": sum(1 for item in game_reports if item["cgCount"]),
        },
        "missingSummary": [item for item in game_reports if not item["hasSummary"]],
        "missingCover": [item for item in game_reports if not item["hasCover"]],
        "missingBgm": [item for item in game_reports if not item["bgmCount"]],
        "missingCg": [item for item in game_reports if not item["cgCount"] and not item.get("ignoreMissingCg")],
        "fallbackBgmCover": [item for item in game_reports if item["usesFallbackBgmCover"]],
    }
    write_json(output_dir / "report.json", report)
    print_report(report)


if __name__ == "__main__":
    main()
