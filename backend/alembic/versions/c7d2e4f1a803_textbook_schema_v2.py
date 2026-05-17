"""textbook_schema_v2 — 3-layer: concept / question / solution

Revision ID: c7d2e4f1a803
Revises: b4e1f9a2c305
Create Date: 2026-05-17 16:00:00.000000

Changes from v1:
- textbook_question: add subpart, question_type, colour, difficulty,
  has_solution (replaces has_answer), related_example_ids, topic_tags;
  remove solution_steps, reference_answer (moved to textbook_solution)
- textbook_concept: add label, solution_steps (for worked_example), topic_tags
- NEW textbook_solution: separate solution layer
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c7d2e4f1a803"
down_revision: Union[str, None] = "b4e1f9a2c305"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── textbook_concept: add columns ────────────────────────────────────────
    op.add_column("textbook_concept",
        sa.Column("label", sa.Text(), nullable=True))
    op.add_column("textbook_concept",
        sa.Column("solution_steps", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("textbook_concept",
        sa.Column("topic_tags", postgresql.ARRAY(sa.Text()), nullable=True))

    # ── textbook_question: add new columns ───────────────────────────────────
    op.add_column("textbook_question",
        sa.Column("subpart", sa.Text(), nullable=True))
    op.add_column("textbook_question",
        sa.Column("question_type", sa.Text(), nullable=False,
                  server_default="problem_solving"))
    op.add_column("textbook_question",
        sa.Column("colour", sa.Text(), nullable=True))
    op.add_column("textbook_question",
        sa.Column("difficulty", sa.Integer(), nullable=True))
    op.add_column("textbook_question",
        sa.Column("has_solution", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("textbook_question",
        sa.Column("related_example_ids",
                  postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True))
    op.add_column("textbook_question",
        sa.Column("topic_tags", postgresql.ARRAY(sa.Text()), nullable=True))

    # migrate has_answer → has_solution, is_drill → question_type
    op.execute("""
        UPDATE textbook_question
        SET has_solution = has_answer,
            question_type = CASE WHEN is_drill THEN 'drill' ELSE 'problem_solving' END
    """)

    # drop old columns from textbook_question
    op.drop_column("textbook_question", "has_answer")
    op.drop_column("textbook_question", "reference_answer")
    op.drop_column("textbook_question", "solution_steps")

    op.create_index("ix_tbq_exercise", "textbook_question", ["exercise_ref"])
    op.create_index("ix_tbq_type", "textbook_question", ["question_type"])

    # ── textbook_solution: new table ─────────────────────────────────────────
    op.create_table(
        "textbook_solution",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.Column("source_doc_id", sa.UUID(), nullable=False),
        sa.Column("source_kind", sa.Text(), nullable=False,
                  server_default="worked_solutions_book"),
        sa.Column("steps", postgresql.JSONB(astext_type=sa.Text()),
                  nullable=False, server_default="[]"),
        sa.Column("final_answer", sa.Text(), nullable=True),
        sa.Column("solution_page", sa.Integer(), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("protected", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["question_id"], ["textbook_question.id"]),
        sa.ForeignKeyConstraint(["source_doc_id"], ["source_document.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tbs_question", "textbook_solution", ["question_id"])
    op.create_index("ix_tbs_source", "textbook_solution", ["source_doc_id"])


def downgrade() -> None:
    op.drop_table("textbook_solution")

    op.add_column("textbook_question",
        sa.Column("has_answer", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("textbook_question",
        sa.Column("reference_answer", sa.Text(), nullable=True))
    op.add_column("textbook_question",
        sa.Column("solution_steps", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.execute("UPDATE textbook_question SET has_answer = has_solution")

    op.drop_column("textbook_question", "subpart")
    op.drop_column("textbook_question", "question_type")
    op.drop_column("textbook_question", "colour")
    op.drop_column("textbook_question", "difficulty")
    op.drop_column("textbook_question", "has_solution")
    op.drop_column("textbook_question", "related_example_ids")
    op.drop_column("textbook_question", "topic_tags")

    op.drop_column("textbook_concept", "label")
    op.drop_column("textbook_concept", "solution_steps")
    op.drop_column("textbook_concept", "topic_tags")
