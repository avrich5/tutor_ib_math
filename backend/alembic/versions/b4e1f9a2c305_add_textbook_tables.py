"""add_textbook_tables

Revision ID: b4e1f9a2c305
Revises: a3f2c8e1d504
Create Date: 2026-05-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b4e1f9a2c305"
down_revision: Union[str, None] = "a3f2c8e1d504"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "source_document",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("job_id", sa.Text(), nullable=True),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "textbook_question",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_doc_id", sa.UUID(), nullable=False),
        sa.Column("topic_id", sa.UUID(), nullable=True),
        sa.Column("chapter", sa.Text(), nullable=False),
        sa.Column("exercise_ref", sa.Text(), nullable=False),
        sa.Column("question_number", sa.Text(), nullable=False),
        sa.Column("stem_md", sa.Text(), nullable=False),
        sa.Column("parts", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_drill", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("has_answer", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("reference_answer", sa.Text(), nullable=True),
        sa.Column("solution_steps", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("origin_page", sa.Integer(), nullable=False),
        sa.Column("protected", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("embedding", sa.Text(), nullable=True),  # vector type added separately
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["source_doc_id"], ["source_document.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["topic.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_doc_id", "exercise_ref", "question_number",
                            name="uq_tbq_source_ref_num"),
    )
    op.create_index("ix_tbq_source", "textbook_question", ["source_doc_id"])
    op.create_index("ix_tbq_topic", "textbook_question", ["topic_id"])

    # Add pgvector column
    op.execute("ALTER TABLE textbook_question DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE textbook_question ADD COLUMN embedding vector(768)")
    op.execute(
        "CREATE INDEX ix_tbq_embedding ON textbook_question "
        "USING ivfflat (embedding vector_cosine_ops) "
        "WHERE embedding IS NOT NULL"
    )

    op.create_table(
        "textbook_concept",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_doc_id", sa.UUID(), nullable=False),
        sa.Column("topic_id", sa.UUID(), nullable=True),
        sa.Column("chapter", sa.Text(), nullable=True),
        sa.Column("section_title", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("text_md", sa.Text(), nullable=False),
        sa.Column("latex_blocks", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("origin_page", sa.Integer(), nullable=False),
        sa.Column("protected", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("embedding", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["source_doc_id"], ["source_document.id"]),
        sa.ForeignKeyConstraint(["topic_id"], ["topic.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tbc_source", "textbook_concept", ["source_doc_id"])

    op.execute("ALTER TABLE textbook_concept DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE textbook_concept ADD COLUMN embedding vector(768)")
    op.execute(
        "CREATE INDEX ix_tbc_embedding ON textbook_concept "
        "USING ivfflat (embedding vector_cosine_ops) "
        "WHERE embedding IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_table("textbook_concept")
    op.drop_table("textbook_question")
    op.drop_table("source_document")
