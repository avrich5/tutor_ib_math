"""add_source_pointers_to_unified_tables

Adds source_type / source_id to question, concept, hint.
Also relaxes question.topic_id and question.reference_answer to nullable
so textbook rows (which have no topic or solution yet) can be mirrored.
Same relaxation for concept.topic_id.

Revision ID: d8e4f2a1b395
Revises: c7d2e4f1a803
Create Date: 2026-05-21 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d8e4f2a1b395"
down_revision: Union[str, None] = "c7d2e4f1a803"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ("question", "concept", "hint")


def upgrade() -> None:
    # ── 1. Add columns nullable first, then tighten ───────────────────────────
    for tbl in _TABLES:
        op.add_column(tbl, sa.Column("source_type", sa.Text(), nullable=True))
        op.add_column(tbl, sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True))

    # ── 2. Backfill existing rows ─────────────────────────────────────────────
    for tbl in _TABLES:
        op.execute(f"UPDATE {tbl} SET source_type = 'generated' WHERE source_type IS NULL")

    # ── 3. Set NOT NULL on source_type ────────────────────────────────────────
    for tbl in _TABLES:
        op.alter_column(tbl, "source_type", nullable=False)

    # ── 4. CHECK constraints ──────────────────────────────────────────────────
    for tbl in _TABLES:
        op.create_check_constraint(
            f"ck_{tbl}_source_type",
            tbl,
            "source_type IN ('generated', 'textbook')",
        )

    # ── 5. Composite indexes ──────────────────────────────────────────────────
    for tbl in _TABLES:
        op.create_index(f"ix_{tbl}_source", tbl, ["source_type", "source_id"])

    # ── 6. Unique constraints (prevent duplicate mirroring) ───────────────────
    for tbl in _TABLES:
        op.execute(
            f"""
            ALTER TABLE {tbl}
            ADD CONSTRAINT uq_{tbl}_source_id
            UNIQUE (source_type, source_id)
            DEFERRABLE INITIALLY DEFERRED
            """
        )
        # The partial-index form (WHERE source_id IS NOT NULL) is more correct
        # but a deferrable unique constraint is simpler for Alembic downgrade.
        # Generated rows have source_id=NULL and are excluded by the UNIQUE check
        # because NULL != NULL in SQL uniqueness semantics.

    # ── 7. Relax topic_id / reference_answer so textbook rows can be inserted ─
    op.alter_column("question", "topic_id", nullable=True)
    op.alter_column("question", "reference_answer", nullable=True)
    op.alter_column("concept", "topic_id", nullable=True)


def downgrade() -> None:
    # Restore NOT NULL (will fail if NULL rows exist — acceptable)
    op.alter_column("concept", "topic_id", nullable=False)
    op.alter_column("question", "reference_answer", nullable=False)
    op.alter_column("question", "topic_id", nullable=False)

    for tbl in _TABLES:
        op.execute(f"ALTER TABLE {tbl} DROP CONSTRAINT IF EXISTS uq_{tbl}_source_id")
        op.drop_index(f"ix_{tbl}_source", tbl)
        op.drop_constraint(f"ck_{tbl}_source_type", tbl)
        op.drop_column(tbl, "source_id")
        op.drop_column(tbl, "source_type")
