from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote, urlparse


AUDIO_EXTENSIONS = {".mp3", ".ogg", ".wav", ".flac", ".m4a", ".aac"}


def normalize(value: str) -> str:
    text = str(value).lower().replace("　", " ")
    for char in "～〜~-‐‑‒–—―：:/／＊*＋+!！？?「」『』“”'\" ":
        text = text.replace(char, "")
    return re.sub(r"\s+", "", text)


def sorted_files(path: Path) -> list[Path]:
    if not path.exists() or not path.is_dir():
        return []
    return sorted((item for item in path.iterdir() if item.is_file()), key=lambda item: item.name.lower())


def load_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def find_song(name: str, song_by_title: dict[str, dict[str, str]]) -> dict[str, str] | None:
    key = normalize(name)
    if key in song_by_title:
        return song_by_title[key]

    for song_key, song in song_by_title.items():
        if key and (key in song_key or song_key in key):
            return song
    return None


def infer_worker_base_url(songs: list[object]) -> str:
    for song in songs:
        if not isinstance(song, dict) or not song.get("url"):
            continue
        parsed = urlparse(str(song["url"]))
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return ""


def infer_worker_base_url_from_assets(assets_dir: Path) -> str:
    for bgm_json_path in sorted(assets_dir.glob("*/bgm/bgm.json")):
        data = load_json(bgm_json_path)
        if not isinstance(data, dict):
            continue
        tracks = data.get("tracks")
        if not isinstance(tracks, list):
            continue
        for track in tracks:
            if not isinstance(track, dict) or not track.get("src"):
                continue
            parsed = urlparse(str(track["src"]))
            if parsed.scheme and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}"
    return ""


def build_worker_url(base_url: str, filename: str) -> str:
    return f"{base_url.rstrip('/')}/{quote(filename)}"


def build_bgm_json(
    game_dir: Path,
    song_by_title: dict[str, dict[str, str]],
    fallback_worker_base_url: str,
) -> tuple[dict[str, object], list[str], int]:
    bgm_dir = game_dir / "bgm"
    audio_files = [item for item in sorted_files(bgm_dir) if item.suffix.lower() in AUDIO_EXTENSIONS]
    tracks: list[dict[str, str]] = []
    missing: list[str] = []
    fallback_count = 0

    for item in audio_files:
        song = find_song(item.stem, song_by_title)
        if song:
            tracks.append(
                {
                    "name": song["title"],
                    "src": song["url"],
                }
            )
            if song.get("cover"):
                tracks[-1]["_cover"] = song["cover"]
            continue

        if fallback_worker_base_url:
            tracks.append(
                {
                    "name": item.stem,
                    "src": build_worker_url(fallback_worker_base_url, item.name),
                }
            )
            fallback_count += 1
            continue

        missing.append(item.stem)

    covers = sorted({track["_cover"] for track in tracks if track.get("_cover")})
    for track in tracks:
        track.pop("_cover", None)
    result: dict[str, object] = {"cover": covers[0] if covers else "", "tracks": tracks}
    return result, missing, fallback_count


def merge_bgm_json(existing: dict[str, object], incoming: dict[str, object]) -> dict[str, object]:
    existing_tracks = existing.get("tracks") if isinstance(existing.get("tracks"), list) else []
    incoming_tracks = incoming.get("tracks") if isinstance(incoming.get("tracks"), list) else []
    merged_tracks: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for track in [*existing_tracks, *incoming_tracks]:
        if not isinstance(track, dict):
            continue
        name = str(track.get("name") or "")
        src = str(track.get("src") or "")
        if not name or not src:
            continue
        key = (normalize(name), src)
        if key in seen:
            continue
        seen.add(key)
        merged_tracks.append({"name": name, "src": src})

    cover = str(existing.get("cover") or incoming.get("cover") or "")
    return {"cover": cover, "tracks": merged_tracks}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Import Cloudflare R2 song links into per-game bgm.json files.")
    parser.add_argument("--songs", default="song.json", help="Source song JSON file.")
    parser.add_argument("--assets-dir", default="assets/game", help="Directory containing numbered game folders.")
    parser.add_argument("--game", help="Only import one game folder, for example 020.")
    parser.add_argument(
        "--worker-base-url",
        default="",
        help="Worker origin used to build URLs for local BGM files missing from song.json.",
    )
    parser.add_argument("--write", action="store_true", help="Write bgm.json files. Defaults to preview only.")
    args = parser.parse_args()

    songs_path = Path(args.songs)
    songs = load_json(songs_path) if songs_path.exists() else []
    if not isinstance(songs, list):
        raise SystemExit("song.json must be a JSON array.")

    song_by_title = {normalize(song["title"]): song for song in songs if isinstance(song, dict) and song.get("title")}
    assets_dir = Path(args.assets_dir)
    fallback_worker_base_url = args.worker_base_url or infer_worker_base_url(songs) or infer_worker_base_url_from_assets(assets_dir)
    if args.game:
        game_dir = assets_dir / args.game
        if not game_dir.exists() or not (game_dir / "game.json").exists():
            raise SystemExit(f"Game folder not found or missing game.json: {game_dir}")
        game_dirs = [game_dir]
    else:
        game_dirs = sorted(
            (item for item in assets_dir.iterdir() if item.is_dir() and item.name != "000" and (item / "game.json").exists()),
            key=lambda item: item.name,
        )

    total_tracks = 0
    total_matched = 0
    total_fallback = 0
    for game_dir in game_dirs:
        game = load_json(game_dir / "game.json")
        bgm_json, missing, fallback_count = build_bgm_json(game_dir, song_by_title, fallback_worker_base_url)
        matched = len(bgm_json["tracks"])
        total_tracks += matched + len(missing)
        total_matched += matched
        total_fallback += fallback_count

        fallback_note = f", {fallback_count} via worker fallback" if fallback_count else ""
        print(f"{game_dir.name} {game.get('title', game_dir.name)}: {matched}/{matched + len(missing)} tracks{fallback_note}")
        if missing:
            print(f"  missing: {'; '.join(missing)}")
        if args.write and matched:
            bgm_json_path = game_dir / "bgm" / "bgm.json"
            existing = load_json(bgm_json_path) if bgm_json_path.exists() else {}
            if not isinstance(existing, dict):
                existing = {}
            write_json(bgm_json_path, merge_bgm_json(existing, bgm_json))

    action = "Written" if args.write else "Previewed"
    print(f"{action} {total_matched}/{total_tracks} tracks. Worker fallback: {total_fallback}.")


if __name__ == "__main__":
    main()
