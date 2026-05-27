from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any


def load_json(path: Path, invalid_json: list[dict[str, str]]) -> Any:
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except json.JSONDecodeError as error:
        invalid_json.append(
            {
                "path": path.as_posix(),
                "error": f"line {error.lineno}, column {error.colno}: {error.msg}",
            }
        )
    except OSError as error:
        invalid_json.append({"path": path.as_posix(), "error": str(error)})
    return None


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def is_blank(value: object) -> bool:
    return not isinstance(value, str) or not value.strip()


def duplicates(values: list[str]) -> list[dict[str, object]]:
    counts = Counter(values)
    return [{"value": value, "count": count} for value, count in counts.items() if count > 1]


def collect_cg_links(game_id: str, data: object, empty_links: list[dict[str, str]]) -> list[str]:
    if not isinstance(data, dict):
        return []

    images = data.get("images")
    if not isinstance(images, list):
        return []

    links: list[str] = []
    for index, item in enumerate(images, start=1):
        if isinstance(item, str):
            src = item
        elif isinstance(item, dict):
            src = item.get("src")
        else:
            src = ""

        if is_blank(src):
            empty_links.append({"game": game_id, "section": "cg", "item": str(index)})
            continue
        links.append(str(src).strip())
    return links


def collect_bgm_tracks(game_id: str, data: object, empty_links: list[dict[str, str]]) -> tuple[list[str], list[str]]:
    if not isinstance(data, dict):
        return [], []

    tracks = data.get("tracks")
    if not isinstance(tracks, list):
        return [], []

    names: list[str] = []
    links: list[str] = []
    for index, item in enumerate(tracks, start=1):
        if not isinstance(item, dict):
            empty_links.append({"game": game_id, "section": "bgm", "item": str(index)})
            continue

        name = item.get("name") or item.get("title")
        src = item.get("src") or item.get("audio")
        if is_blank(src):
            empty_links.append({"game": game_id, "section": "bgm", "item": str(name or index)})
        else:
            links.append(str(src).strip())

        if not is_blank(name):
            names.append(str(name).strip())

    return names, links


def validate_assets(assets_dir: Path) -> dict[str, object]:
    invalid_json: list[dict[str, str]] = []
    empty_links: list[dict[str, str]] = []
    duplicate_links: list[dict[str, object]] = []
    duplicate_track_names: list[dict[str, object]] = []

    json_paths = sorted(assets_dir.rglob("*.json"), key=lambda item: item.as_posix().lower())
    parsed_json = {path: load_json(path, invalid_json) for path in json_paths}

    game_dirs = sorted(
        (item for item in assets_dir.iterdir() if item.is_dir() and item.name != "000" and (item / "game.json").exists()),
        key=lambda item: item.name.lower(),
    )

    all_links: list[tuple[str, str, str]] = []
    for game_dir in game_dirs:
        game_id = game_dir.name

        cg_path = game_dir / "cg" / "cg.json"
        cg_links = collect_cg_links(game_id, parsed_json.get(cg_path), empty_links)
        all_links.extend((link, game_id, "cg") for link in cg_links)

        bgm_path = game_dir / "bgm" / "bgm.json"
        track_names, bgm_links = collect_bgm_tracks(game_id, parsed_json.get(bgm_path), empty_links)
        all_links.extend((link, game_id, "bgm") for link in bgm_links)

        for item in duplicates(track_names):
            duplicate_track_names.append({"game": game_id, **item})

        for item in duplicates(cg_links + bgm_links):
            duplicate_links.append({"game": game_id, **item})

    global_link_counts = Counter(link for link, _game_id, _section in all_links)
    for link, count in global_link_counts.items():
        if count <= 1:
            continue
        locations = [
            {"game": game_id, "section": section}
            for candidate, game_id, section in all_links
            if candidate == link
        ]
        duplicate_links.append({"game": "*", "value": link, "count": count, "locations": locations})

    return {
        "totals": {
            "jsonFiles": len(json_paths),
            "games": len(game_dirs),
            "invalidJson": len(invalid_json),
            "emptyLinks": len(empty_links),
            "duplicateLinks": len(duplicate_links),
            "duplicateTrackNames": len(duplicate_track_names),
        },
        "invalidJson": invalid_json,
        "emptyLinks": empty_links,
        "duplicateLinks": duplicate_links,
        "duplicateTrackNames": duplicate_track_names,
    }


def print_report(report: dict[str, object]) -> None:
    totals = report["totals"]
    print(
        "Validation: "
        f"{totals['jsonFiles']} JSON files, "
        f"{totals['games']} games, "
        f"{totals['invalidJson']} invalid JSON, "
        f"{totals['emptyLinks']} empty links, "
        f"{totals['duplicateLinks']} duplicate links, "
        f"{totals['duplicateTrackNames']} duplicate track names"
    )

    for key, label in (
        ("invalidJson", "Invalid JSON"),
        ("emptyLinks", "Empty links"),
        ("duplicateLinks", "Duplicate links"),
        ("duplicateTrackNames", "Duplicate track names"),
    ):
        items = report[key]
        if not items:
            continue
        print(f"{label}:")
        for item in items[:20]:
            print(f"  - {item}")
        if len(items) > 20:
            print(f"  ... and {len(items) - 20} more")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Validate game asset JSON and resource links.")
    parser.add_argument("--assets-dir", default="assets/game", help="Directory containing one folder per game.")
    parser.add_argument("--output", default="assets/json/validation.json", help="Path for the validation report.")
    args = parser.parse_args()

    report = validate_assets(Path(args.assets_dir))
    write_json(Path(args.output), report)
    print_report(report)


if __name__ == "__main__":
    main()
