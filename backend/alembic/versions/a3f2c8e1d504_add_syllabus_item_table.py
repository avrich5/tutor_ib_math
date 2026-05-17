"""add_syllabus_item_table

Revision ID: a3f2c8e1d504
Revises: 9b59da910a6d
Create Date: 2026-05-17 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a3f2c8e1d504"
down_revision: Union[str, None] = "9b59da910a6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "syllabus_item",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("topic_id", sa.UUID(), nullable=False),
        sa.Column("ib_ref", sa.Text(), nullable=False),
        sa.Column("guide_text", sa.Text(), nullable=False),
        sa.Column("command_terms", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("example_questions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("formula_booklet_refs", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["topic_id"], ["topic.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("topic_id", "ib_ref", name="uq_syllabus_item_topic_ref"),
    )
    op.create_index("ix_syllabus_item_topic", "syllabus_item", ["topic_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_syllabus_item_topic", table_name="syllabus_item")
    op.drop_table("syllabus_item")
