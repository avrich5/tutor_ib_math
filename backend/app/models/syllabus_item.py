import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, ForeignKey, Index, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SyllabusItem(Base):
    __tablename__ = "syllabus_item"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topic.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ib_ref: Mapped[str] = mapped_column(Text, nullable=False)
    guide_text: Mapped[str] = mapped_column(Text, nullable=False)
    command_terms: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    example_questions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    formula_booklet_refs: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("topic_id", "ib_ref", name="uq_syllabus_item_topic_ref"),
        Index("ix_syllabus_item_topic", "topic_id"),
    )
