import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, Boolean, DateTime, ForeignKey, Index, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Question(Base):
    __tablename__ = "question"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topic.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)
    difficulty: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    stem_md: Mapped[str] = mapped_column(Text, nullable=False)
    stem_latex: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_answer: Mapped[str] = mapped_column(Text, nullable=False)
    reference_answer_tex: Mapped[str | None] = mapped_column(Text, nullable=True)
    mc_options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    mc_correct_key: Mapped[str | None] = mapped_column(String, nullable=True)
    ordered_steps: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    variables: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    solution_steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    related_concept_ids: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    wolfram_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending_review", index=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_question_difficulty", "difficulty"),
        Index("ix_question_embedding", "embedding", postgresql_using="ivfflat",
              postgresql_ops={"embedding": "vector_cosine_ops"}),
    )
