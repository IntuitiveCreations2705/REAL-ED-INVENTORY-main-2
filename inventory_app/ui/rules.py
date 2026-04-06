"""Shared backend business rules used across API views.

Keep normalization and computed-field logic here so all routes/views enforce
the same data behavior.
"""
from __future__ import annotations

from typing import Any


def parse_pipe_tags(raw_tags: str | None) -> list[str]:
    if not raw_tags:
        return []

    tokens: list[str] = []
    for chunk in str(raw_tags).split("|"):
        tag = chunk.strip()
        if not tag:
            continue
        tokens.append(f"|{tag}|")

    # Preserve order, remove duplicates.
    return list(dict.fromkeys(tokens))


def normalize_pipe_tags(raw_tags: str | None) -> str:
    """Normalize tag text to canonical pipe format: |TAG1||TAG2| (uppercase)."""
    if raw_tags is None:
        return ""

    text = str(raw_tags).strip()
    if not text:
        return ""

    # Accept values typed as |NEEDED|, comma-separated, or plain words.
    chunks: list[str] = []
    for part in text.replace(",", "|").split("|"):
        token = part.strip()
        if not token:
            continue
        chunks.append(token.upper())

    unique = list(dict.fromkeys(chunks))
    return "".join(f"|{tag}|" for tag in unique)


def normalize_location_label(raw_value: Any) -> str | None:
    if raw_value is None:
        return None
    text = str(raw_value).strip()
    if not text:
        return None
    return text.upper()


def as_number(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    return float(value)


def computed_order_stock_qty(qty_required: Any, stock_on_hand: Any) -> float:
    return max(as_number(qty_required) - as_number(stock_on_hand), 0.0)
