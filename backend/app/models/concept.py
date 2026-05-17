import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Concept(Base):
    __tablename__ = "concept"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topic.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)  # definition|theorem|method|axiom
    title: Mapped[str] = mapped_column(String, nullable=False)
    statement_md: Mapped[str] = mapped_column(Text, nullable=False)
    proof_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    examples_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_concept_embedding", "embedding", postgresql_using="ivfflat",
              postgresql_ops={"embedding": "vector_cosine_ops"}),
    )
