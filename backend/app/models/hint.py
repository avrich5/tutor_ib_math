import uuid

from sqlalchemy import ForeignKey, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Hint(Base):
    __tablename__ = "hint"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type: Mapped[str] = mapped_column(String, nullable=False, default="generated")
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("question.id", ondelete="CASCADE"), nullable=False
    )
    tier: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1|2|3
    kind: Mapped[str] = mapped_column(String, nullable=False)  # recall|apply|full
    text_md: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (UniqueConstraint("question_id", "tier"),)
