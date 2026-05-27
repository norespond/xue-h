from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


SENTENCE_BREAK_PATTERN = re.compile(r"(……[？?]?|…[？?]?|[。！？?!]+[）】」』》]?|[!?]+[\)\]\"']?)")
SPACE_BREAK_PATTERN = re.compile(r"(?:\r?\n|\s{2,})+")
SECTION_MARK_PATTERN = re.compile(r"(故事简介：|剧情简介：|STORY：|Story：|STORY:|Story:)")
CLOSING_PREFIXES = "）】」』》)]\"'"


def merge_broken_lines(lines: list[str]) -> list[str]:
    merged: list[str] = []
    for line in lines:
        if not merged:
            merged.append(line)
            continue

        previous = merged[-1]
        starts_with_closer = line[0] in CLOSING_PREFIXES
        continues_ellipsis_question = line[0] in {"？", "?"} and previous.endswith(("…", "……"))
        continues_closing_quote = previous.endswith(("「", "『", "“", '"', "'"))

        if starts_with_closer or continues_ellipsis_question or continues_closing_quote:
            merged[-1] = previous + line
        else:
            merged.append(line)
    return merged


def split_summary(text: str) -> str:
    text = SPACE_BREAK_PATTERN.sub("\n", text.strip())
    text = SECTION_MARK_PATTERN.sub(r"\n\1\n", text)
    text = SENTENCE_BREAK_PATTERN.sub(r"\1\n", text)
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    lines = merge_broken_lines(lines)
    return "\n".join(lines)


def preview(path: Path) -> None:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    summary = str(data.get("summary") or "")
    formatted = split_summary(summary)

    print(f"== {path} ==")
    print(formatted or "(summary is empty)")


def format_file(path: Path, write: bool) -> None:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    summary = str(data.get("summary") or "")
    formatted = split_summary(summary)

    if write:
        if formatted != summary:
            data["summary"] = formatted
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"updated {path}")
        else:
            print(f"unchanged {path}")
        return

    print(f"== {path} ==")
    print(formatted or "(summary is empty)")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Preview summary line breaks for game.json files.")
    parser.add_argument("paths", nargs="+", help="game.json paths to preview")
    parser.add_argument("--write", action="store_true", help="Write formatted summaries back to the JSON files.")
    args = parser.parse_args()

    for raw_path in args.paths:
        format_file(Path(raw_path), args.write)


if __name__ == "__main__":
    main()
