"""
SM-2 spaced repetition algorithm.
Pure functions — no DB, no FastAPI, no external deps.
Portable to any subject tutor.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CardState:
    easiness: float = 2.5
    interval_days: int = 0
    repetitions: int = 0


@dataclass(frozen=True)
class ReviewOutcome:
    next_state: CardState
    interval_days: int
    due_offset_seconds: int  # how far in the future the card is due


def schedule_next(state: CardState, quality: int) -> ReviewOutcome:
    """
    Compute the next SRS state after a review.

    quality: 0-5 (SM-2 scale)
      0 = complete blackout
      1 = incorrect, close
      2 = incorrect, easy recall
      3 = correct with serious difficulty
      4 = correct with hesitation
      5 = perfect recall

    Returns a new immutable CardState + convenience fields.
    """
    if quality < 0 or quality > 5:
        raise ValueError(f"quality must be 0-5, got {quality}")

    if quality < 3:
        # Failed: reset repetitions and interval
        new_reps = 0
        new_interval = 1
    else:
        new_reps = state.repetitions + 1
        if new_reps == 1:
            new_interval = 1
        elif new_reps == 2:
            new_interval = 6
        else:
            new_interval = round(state.interval_days * state.easiness)

    # Update easiness factor (clamped to [1.3, ∞))
    new_easiness = state.easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    new_easiness = max(1.3, new_easiness)

    new_state = CardState(
        easiness=new_easiness,
        interval_days=new_interval,
        repetitions=new_reps,
    )
    return ReviewOutcome(
        next_state=new_state,
        interval_days=new_interval,
        due_offset_seconds=new_interval * 86400,
    )
