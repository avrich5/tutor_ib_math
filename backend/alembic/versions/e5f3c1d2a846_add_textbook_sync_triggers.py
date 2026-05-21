"""add_textbook_sync_triggers

PL/pgSQL triggers that keep unified question/concept rows in sync with
their textbook_* source rows.

  - UPDATE textbook_question  → UPDATE question  (stem_md, difficulty, embedding, topic_id)
  - UPDATE textbook_concept   → UPDATE concept   (statement_md, title, embedding, topic_id)
  - INSERT textbook_question  → INSERT question  (auto-mirror new chapters without re-seeding)
  - INSERT textbook_concept   → INSERT concept   (same)

Revision ID: e5f3c1d2a846
Revises: d8e4f2a1b395
Create Date: 2026-05-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "e5f3c1d2a846"
down_revision: Union[str, None] = "d8e4f2a1b395"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── UPDATE sync: textbook_question → question ─────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_textbook_question_to_unified()
        RETURNS trigger AS $$
        BEGIN
            UPDATE question
            SET stem_md    = NEW.stem_md,
                difficulty = COALESCE(NEW.difficulty, 3),
                embedding  = NEW.embedding,
                topic_id   = NEW.topic_id
            WHERE source_type = 'textbook' AND source_id = NEW.id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_sync_textbook_question
        AFTER UPDATE ON textbook_question
        FOR EACH ROW EXECUTE FUNCTION sync_textbook_question_to_unified();
    """)

    # ── UPDATE sync: textbook_concept → concept ───────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_textbook_concept_to_unified()
        RETURNS trigger AS $$
        BEGIN
            UPDATE concept
            SET statement_md = NEW.text_md,
                title        = COALESCE(NEW.label, NEW.section_title, title),
                embedding    = NEW.embedding,
                topic_id     = NEW.topic_id
            WHERE source_type = 'textbook' AND source_id = NEW.id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_sync_textbook_concept
        AFTER UPDATE ON textbook_concept
        FOR EACH ROW EXECUTE FUNCTION sync_textbook_concept_to_unified();
    """)

    # ── INSERT mirror: textbook_question → question ───────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION mirror_new_textbook_question()
        RETURNS trigger AS $$
        BEGIN
            INSERT INTO question
                (id, source_type, source_id, topic_id, stem_md, kind,
                 difficulty, status, embedding, solution_steps, related_concept_ids)
            VALUES (
                gen_random_uuid(), 'textbook', NEW.id, NEW.topic_id, NEW.stem_md,
                'free_expression', COALESCE(NEW.difficulty, 3), 'approved',
                NEW.embedding, '[]'::jsonb, ARRAY[]::uuid[]
            )
            ON CONFLICT DO NOTHING;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_mirror_new_textbook_question
        AFTER INSERT ON textbook_question
        FOR EACH ROW EXECUTE FUNCTION mirror_new_textbook_question();
    """)

    # ── INSERT mirror: textbook_concept → concept ─────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION mirror_new_textbook_concept()
        RETURNS trigger AS $$
        BEGIN
            INSERT INTO concept
                (id, source_type, source_id, slug, topic_id, kind, title,
                 statement_md, embedding)
            VALUES (
                gen_random_uuid(), 'textbook', NEW.id,
                'tb-' || NEW.id::text,
                NEW.topic_id,
                NEW.kind,
                COALESCE(NEW.label, NEW.section_title, 'Concept'),
                NEW.text_md,
                NEW.embedding
            )
            ON CONFLICT DO NOTHING;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_mirror_new_textbook_concept
        AFTER INSERT ON textbook_concept
        FOR EACH ROW EXECUTE FUNCTION mirror_new_textbook_concept();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_mirror_new_textbook_concept ON textbook_concept")
    op.execute("DROP FUNCTION IF EXISTS mirror_new_textbook_concept()")
    op.execute("DROP TRIGGER IF EXISTS trg_mirror_new_textbook_question ON textbook_question")
    op.execute("DROP FUNCTION IF EXISTS mirror_new_textbook_question()")
    op.execute("DROP TRIGGER IF EXISTS trg_sync_textbook_concept ON textbook_concept")
    op.execute("DROP FUNCTION IF EXISTS sync_textbook_concept_to_unified()")
    op.execute("DROP TRIGGER IF EXISTS trg_sync_textbook_question ON textbook_question")
    op.execute("DROP FUNCTION IF EXISTS sync_textbook_question_to_unified()")
