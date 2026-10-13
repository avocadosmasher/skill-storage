#!/usr/bin/env python3
"""Local Markdown idea bank. Uses Python 3.10+ and the standard library."""

import argparse
from contextlib import contextmanager
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from uuid import uuid4


KINDS = {"skill", "agent", "app", "automation", "learning", "content", "other"}
STATUSES = {"inbox", "exploring", "ready", "active", "done", "archived"}
ID_PATTERN = re.compile(r"IB-\d{8}-\d{6}-[a-f0-9]{8}\Z")
BANK_ENV = "IDEA_BANK_PATH"


def read_json(path):
    value = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError("JSON input must be an object")
    return value


def string(value, name, nonempty=False, single_line=False):
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string")
    if nonempty and not value.strip():
        raise ValueError(f"{name} must not be blank")
    if single_line and ("\n" in value or "\r" in value):
        raise ValueError(f"{name} must be a single line")
    return value


def strings(value, name):
    if not isinstance(value, list):
        raise ValueError(f"{name} must be an array")
    return list(dict.fromkeys(string(item, name, nonempty=True).strip() for item in value))


def choice(value, choices, name):
    if not isinstance(value, str) or value not in choices:
        raise ValueError(f"{name} must be one of: {', '.join(sorted(choices))}")
    return value


def check_id(value):
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise ValueError("Invalid idea ID")
    return value


def bank_path(args):
    if args.bank is not None:
        return Path(args.bank).expanduser().resolve()
    value = os.environ.get(BANK_ENV, "").strip()
    if value:
        path = Path(value).expanduser()
        if not path.is_absolute():
            raise ValueError(f"{BANK_ENV} must be an absolute path")
        return path.resolve()
    return (Path.home() / "idea-bank").resolve()


def atomic_write(path, text):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="\n", dir=path.parent,
            prefix=".idea-bank-", suffix=".tmp", delete=False,
        ) as handle:
            temporary = Path(handle.name)
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


@contextmanager
def writing(bank):
    bank.mkdir(parents=True, exist_ok=True)
    lock = bank / ".write.lock"
    try:
        handle = lock.open("x", encoding="utf-8")
    except FileExistsError:
        raise ValueError(f"Bank is busy or has a stale lock: {lock}") from None
    try:
        with handle:
            handle.write(str(os.getpid()))
        yield
    finally:
        lock.unlink()


def check_bank(bank):
    marker = bank / "bank.json"
    if not marker.exists():
        if (bank / "ideas").exists():
            raise ValueError("Existing ideas directory has no bank.json; inspect before initializing")
        return False
    data = read_json(marker)
    if data.get("format") != "idea-banking" or data.get("schema_version") != 1:
        raise ValueError("Unsupported bank format")
    return True


def initialize(bank):
    if not check_bank(bank):
        marker = {"format": "idea-banking", "schema_version": 1}
        atomic_write(bank / "bank.json", json.dumps(marker, indent=2) + "\n")
    (bank / "ideas").mkdir(exist_ok=True)


def card_path(bank, idea_id):
    return bank / "ideas" / f"{check_id(idea_id)}.md"


def load_card(path):
    with path.open(encoding="utf-8", newline="") as handle:
        text = handle.read()
    opening = re.match(r"\A---\r?\n", text)
    if opening is None:
        raise ValueError("Card must start with JSON frontmatter")
    closing = re.search(r"\r?\n---\r?\n", text[opening.end():])
    if closing is None:
        raise ValueError("Missing frontmatter delimiter")
    header_end = opening.end() + closing.start()
    body_start = opening.end() + closing.end()
    header, body = text[opening.end():header_end], text[body_start:]
    metadata = json.loads(header)
    if not isinstance(metadata, dict) or metadata.get("schema_version") != 1:
        raise ValueError("Unsupported card format")
    if check_id(metadata.get("id")) != path.stem:
        raise ValueError("Card ID does not match filename")
    string(metadata.get("title"), "title", nonempty=True, single_line=True)
    string(metadata.get("summary"), "summary")
    string(metadata.get("source"), "source")
    choice(metadata.get("kind"), KINDS, "kind")
    choice(metadata.get("status"), STATUSES, "status")
    strings(metadata.get("tags"), "tags")
    for related in strings(metadata.get("related_ids"), "related_ids"):
        check_id(related)
    for field in ("created_at", "updated_at"):
        timestamp = datetime.fromisoformat(string(metadata.get(field), field))
        if timestamp.utcoffset() is None:
            raise ValueError(f"{field} must include a timezone offset")
    return metadata, body, text


def render(metadata, body):
    return "---\n" + json.dumps(metadata, ensure_ascii=False, indent=2) + "\n---\n" + body


def revision(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def result_card(path):
    metadata, _, document = load_card(path)
    return {**metadata, "path": str(path), "revision": revision(document), "document": document}


def capture(bank, payload):
    allowed = {"original", "title", "summary", "kind", "tags", "source", "assistant_note"}
    if set(payload) - allowed:
        raise ValueError(f"Unknown capture fields: {sorted(set(payload) - allowed)}")
    original = string(payload.get("original"), "original", nonempty=True)
    title = payload.get("title")
    if title is None:
        title = next(line.strip() for line in original.splitlines() if line.strip())[:80]
    title = string(title, "title", nonempty=True, single_line=True)
    now = datetime.now().astimezone()
    idea_id = f"IB-{now:%Y%m%d-%H%M%S}-{uuid4().hex[:8]}"
    metadata = {
        "schema_version": 1, "id": idea_id, "title": title,
        "summary": string(payload.get("summary", ""), "summary"),
        "kind": choice(payload.get("kind", "other"), KINDS, "kind"),
        "tags": strings(payload.get("tags", []), "tags"), "status": "inbox",
        "created_at": now.isoformat(timespec="seconds"),
        "updated_at": now.isoformat(timespec="seconds"), "related_ids": [],
        "source": string(payload.get("source", ""), "source"),
    }
    body = f"\n# {title}\n\n## 사용자 원문\n\n{original}"
    assistant_note = string(payload.get("assistant_note", ""), "assistant_note")
    if assistant_note.strip():
        body += f"\n\n## AI 첨언 (미검증 제안)\n\n{assistant_note}"
    with writing(bank):
        initialize(bank)
        path = card_path(bank, idea_id)
        if path.exists():
            raise ValueError("ID collision; capture was not saved")
        atomic_write(path, render(metadata, body))
        saved = result_card(path)
    return {"ok": True, "bank": str(bank), "idea": saved}


def query(bank, args):
    cards, warnings = [], []
    if check_bank(bank):
        for path in sorted((bank / "ideas").glob("IB-*.md")):
            try:
                metadata, _, document = load_card(path)
            except (OSError, ValueError, TypeError) as error:
                warnings.append({"path": str(path), "error": str(error)})
                continue
            if metadata["status"] == "archived" and not args.include_archived and args.status != "archived":
                continue
            if args.status and metadata["status"] != args.status:
                continue
            if args.kind and metadata["kind"] != args.kind:
                continue
            if args.tag and args.tag.casefold() not in [tag.casefold() for tag in metadata["tags"]]:
                continue
            if args.command == "search":
                terms = args.query.casefold().split()
                matches = [term in document.casefold() for term in terms]
                if not (all(matches) if args.match == "all" else any(matches)):
                    continue
            cards.append({**metadata, "path": str(path)})
    cards.sort(key=lambda card: (datetime.fromisoformat(card["created_at"]), card["id"]), reverse=True)
    page = cards[args.offset:args.offset + args.limit]
    return {
        "ok": True, "bank": str(bank), "total": len(cards), "offset": args.offset,
        "ideas": page, "has_more": args.offset + len(page) < len(cards), "warnings": warnings,
    }


def update(bank, idea_id, payload, expected_revision):
    allowed = {"title", "summary", "kind", "tags", "status", "add_related_ids", "note"}
    if not payload or set(payload) - allowed:
        raise ValueError("Patch must contain only supported fields and must not be empty")
    if not check_bank(bank):
        raise ValueError("Bank is not initialized")
    with writing(bank):
        path = card_path(bank, idea_id)
        metadata, body, document = load_card(path)
        if revision(document) != expected_revision:
            raise ValueError("Revision conflict: read the current card before updating")
        previous_title = metadata["title"]
        for field in ("title", "summary"):
            if field in payload:
                metadata[field] = string(payload[field], field, nonempty=field == "title", single_line=field == "title")
        if "title" in payload:
            heading = re.match(r"\r?\n# " + re.escape(previous_title) + r"\r?\n", body)
            if heading is not None:
                body = "\n# " + metadata["title"] + "\n" + body[heading.end():]
        for field, choices in (("kind", KINDS), ("status", STATUSES)):
            if field in payload:
                metadata[field] = choice(payload[field], choices, field)
        if "tags" in payload:
            metadata["tags"] = strings(payload["tags"], "tags")
        for related in strings(payload.get("add_related_ids", []), "add_related_ids"):
            if related == idea_id:
                raise ValueError("An idea cannot link to itself")
            load_card(card_path(bank, related))
            if related not in metadata["related_ids"]:
                metadata["related_ids"].append(related)
        note = string(payload.get("note", ""), "note")
        now = datetime.now().astimezone().isoformat(timespec="seconds")
        if note.strip():
            body += f"\n\n## 추가 기록 · {now}\n\n{note}"
        metadata["updated_at"] = now
        atomic_write(path, render(metadata, body))
        saved = result_card(path)
    return {"ok": True, "bank": str(bank), "idea": saved}


def nonnegative(value):
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("Value must be nonnegative")
    return number


def positive(value):
    number = nonnegative(value)
    if number == 0:
        raise argparse.ArgumentTypeError("Value must be positive")
    return number


def parser():
    root = argparse.ArgumentParser(description=__doc__)
    root.add_argument("--bank", help="Override the bank directory for this invocation")
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("init")
    add = commands.add_parser("capture")
    add.add_argument("--input", required=True, help="UTF-8 JSON file containing original and optional metadata")
    for name in ("list", "search"):
        view = commands.add_parser(name)
        view.add_argument("--status", choices=sorted(STATUSES))
        view.add_argument("--kind", choices=sorted(KINDS))
        view.add_argument("--tag")
        view.add_argument("--include-archived", action="store_true")
        view.add_argument("--limit", type=positive, default=20)
        view.add_argument("--offset", type=nonnegative, default=0)
        if name == "search":
            view.add_argument("--query", required=True)
            view.add_argument("--match", choices=("all", "any"), default="all")
    show = commands.add_parser("show")
    show.add_argument("idea_id")
    patch = commands.add_parser("update")
    patch.add_argument("idea_id")
    patch.add_argument("--input", required=True)
    patch.add_argument("--expected-revision", required=True)
    return root


def main():
    args = parser().parse_args()
    try:
        bank = bank_path(args)
        if args.command == "init":
            with writing(bank):
                initialize(bank)
            result = {"ok": True, "bank": str(bank)}
        elif args.command == "capture":
            result = capture(bank, read_json(args.input))
        elif args.command in ("list", "search"):
            if args.command == "search" and not args.query.strip():
                raise ValueError("Search query must not be blank")
            result = query(bank, args)
        elif args.command == "show":
            if not check_bank(bank):
                raise ValueError("Bank is not initialized")
            result = {"ok": True, "bank": str(bank), "idea": result_card(card_path(bank, args.idea_id))}
        else:
            result = update(bank, args.idea_id, read_json(args.input), args.expected_revision)
    except (OSError, ValueError, TypeError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
