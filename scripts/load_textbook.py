#!/usr/bin/env python3
"""
Load pdf_ingest_agent JSONL output into tutor_ib_math DB.

Usage:
  python3 scripts/load_textbook.py [--dry-run] [--skip-embed] [JSONL_GLOB]

Default glob: ~/home_services/pdf_ingest_agent/jobs/*/output.jsonl
"""
from __future__ import annotations

import argparse
import asyncio
import glob
import json
import os
import sys
import time
import uuid
from pathlib import Path

import httpx

# ── DB setup ──────────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
os.chdir(Path(__file__).parent.parent / "backend")

from app.config import settings
from app.db import SessionLocal
from app.models.textbook import SourceDocument, TextbookConcept, TextbookQuestion

# ── Constants ─────────────────────────────────────────────────────────────────

CONCEPT_TYPES = {"theory", "key_point", "chapter_intro", "connection_note",
                 "worked_example", "be_the_examiner"}

SOURCE_SLUG = "haese_aa_hl_main"
SOURCE_TITLE = "Haese Mathematics — Mathematics: Analysis and Approaches HL"
SOURCE_FILE = "haese_aa_hl_main.pdf"

DEFAULT_GLOB = str(
    Path.home() / "home_services/pdf_ingest_agent/jobs/*/output.jsonl"
)


# ── Embedding helper ──────────────────────────────────────────────────────────

async def embed(text: str) -> list[float] | None:
    embed_url = settings.embedding_agent_url.rstrip("/") + "/embed"
    try:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(embed_url, json={"text": text})
            r.raise_for_status()
            return r.json()["embedding"]
    except Exception as exc:
        print(f"  [warn] embed failed: {exc}")
        return None


# ── Main loader ───────────────────────────────────────────────────────────────

def collect_records(jsonl_glob: str) -> list[dict]:
    records: list[dict] = []
    paths = sorted(glob.glob(jsonl_glob))
    if not paths:
        sys.exit(f"No JSONL files found at: {jsonl_glob}")
    for p in paths:
        with open(p) as f:
            batch = [json.loads(line) for line in f if line.strip()]
        print(f"  {p}: {len(batch)} records")
        records.extend(batch)
    return records


def get_or_create_source(db) -> SourceDocument:
    src = db.query(SourceDocument).filter_by(slug=SOURCE_SLUG).first()
    if src:
        return src
    src = SourceDocument(
        id=uuid.uuid4(),
        slug=SOURCE_SLUG,
        title=SOURCE_TITLE,
        kind="textbook",
        filename=SOURCE_FILE,
    )
    db.add(src)
    db.flush()
    return src


def _str_field(val) -> str:
    """Normalise a field that might be str, list, or None → str."""
    if val is None:
        return ""
    if isinstance(val, list):
        return " ".join(str(v) for v in val)
    return str(val)


def text_for_embed(record: dict) -> str:
    raw = record.get("text_md") or record.get("stem_md")
    text = _str_field(raw)
    label = record.get("label") or ""
    section = record.get("section_title") or ""
    if label:
        return f"{label}: {text}"
    if section and len(text) < 200:
        return f"{section} — {text}"
    return text


async def load(jsonl_glob: str, dry_run: bool, skip_embed: bool) -> None:
    print(f"\nCollecting JSONL records from: {jsonl_glob}")
    records = collect_records(jsonl_glob)
    print(f"Total records: {len(records)}\n")

    kind_counts: dict[str, int] = {}
    for r in records:
        k = r.get("kind") or r.get("record_type") or "?"
        kind_counts[k] = kind_counts.get(k, 0) + 1
    print("Breakdown:", kind_counts, "\n")

    if dry_run:
        print("[dry-run] No changes written.")
        return

    db = SessionLocal()
    try:
        src = get_or_create_source(db)
        print(f"Source doc: {src.slug} ({src.id})\n")

        # Pre-load existing dedup keys to avoid per-row DB checks
        existing_concepts: set[tuple] = {
            (row.kind, row.origin_page, row.section_title)
            for row in db.query(
                TextbookConcept.kind,
                TextbookConcept.origin_page,
                TextbookConcept.section_title,
            ).filter_by(source_doc_id=src.id).all()
        }
        existing_questions: set[tuple] = {
            (row.exercise_ref, row.question_number)
            for row in db.query(
                TextbookQuestion.exercise_ref,
                TextbookQuestion.question_number,
            ).filter_by(source_doc_id=src.id).all()
        }

        concepts_added = concepts_skipped = 0
        questions_added = questions_skipped = 0

        for i, rec in enumerate(records):
            rec_type = rec.get("record_type", "")
            kind = rec.get("kind") or rec_type

            # ── Concept records ──────────────────────────────────────────────
            if kind in CONCEPT_TYPES:
                section = rec.get("section_title", "")
                chapter = rec.get("chapter")
                label = rec.get("label")
                origin_page = rec.get("origin_page", 0)
                text_md = rec.get("text_md") or rec.get("stem_md") or ""

                dedup_key = (kind, origin_page, section)
                if dedup_key in existing_concepts:
                    concepts_skipped += 1
                    continue
                existing_concepts.add(dedup_key)

                embedding = None
                if not skip_embed and text_md.strip():
                    embedding = await embed(text_for_embed(rec))
                    time.sleep(0.05)

                obj = TextbookConcept(
                    id=uuid.uuid4(),
                    source_doc_id=src.id,
                    chapter=chapter,
                    section_title=section,
                    kind=kind,
                    label=label,
                    text_md=text_md,
                    latex_blocks=rec.get("latex_blocks") or [],
                    origin_page=origin_page,
                    protected=rec.get("protected", True),
                    embedding=embedding,
                )
                db.add(obj)
                concepts_added += 1
                print(f"  [C{concepts_added:04d}] ch{chapter} p{origin_page} {kind[:16]:<16} {text_md[:55]!r}")

            # ── Question records ─────────────────────────────────────────────
            elif rec_type == "exercise_question":
                chapter = rec.get("chapter", "?")
                exercise_ref = rec.get("exercise_ref", "?")
                question_number = str(rec.get("question_number", "?"))
                stem_md = _str_field(rec.get("stem_md"))
                origin_page = rec.get("origin_page", 0)
                is_drill = rec.get("is_drill", False)
                colour = rec.get("colour")
                has_answer = rec.get("has_answer", False)

                dedup_key = (exercise_ref, question_number)
                if dedup_key in existing_questions:
                    questions_skipped += 1
                    continue
                existing_questions.add(dedup_key)

                embedding = None
                if not skip_embed and stem_md.strip():
                    embedding = await embed(text_for_embed(rec))
                    time.sleep(0.05)

                obj = TextbookQuestion(
                    id=uuid.uuid4(),
                    source_doc_id=src.id,
                    chapter=chapter,
                    exercise_ref=exercise_ref,
                    question_number=question_number,
                    stem_md=stem_md,
                    parts=rec.get("parts"),
                    question_type="drill" if is_drill else "problem_solving",
                    is_drill=is_drill,
                    colour=colour,
                    has_solution=has_answer,
                    origin_page=origin_page,
                    protected=rec.get("protected", True),
                    embedding=embedding,
                )
                db.add(obj)
                questions_added += 1
                print(f"  [Q{questions_added:04d}] ch{chapter} ex{exercise_ref} Q{question_number:<4} {stem_md[:55]!r}")

            else:
                pass  # unrecognised record_type — skip silently

            # Commit in batches of 50
            if (concepts_added + questions_added) % 50 == 0 and (concepts_added + questions_added) > 0:
                db.commit()
                print(f"  ... committed {concepts_added + questions_added} so far")

        db.commit()

    finally:
        db.close()

    print(f"\n✓ Concepts:  added={concepts_added}  skipped={concepts_skipped}")
    print(f"✓ Questions: added={questions_added}  skipped={questions_skipped}")
    print(f"✓ Total new: {concepts_added + questions_added}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Load Haese JSONL into tutor_ib_math")
    parser.add_argument("jsonl_glob", nargs="?", default=DEFAULT_GLOB,
                        help="glob for output.jsonl files")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show counts only, no DB writes")
    parser.add_argument("--skip-embed", action="store_true",
                        help="Skip embedding calls (store NULL)")
    args = parser.parse_args()

    asyncio.run(load(args.jsonl_glob, args.dry_run, args.skip_embed))


if __name__ == "__main__":
    main()
