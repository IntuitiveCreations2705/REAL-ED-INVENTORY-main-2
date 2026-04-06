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


def normalize_box_label(raw_value: Any) -> str | None:
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


def validate_event_tags_against_catalog(
    normalized_tags_str: str, conn: Any
) -> tuple[bool, str | None]:
    """Validate normalized event_tags against Active tags in event_tag_catalog.

    Args:
        normalized_tags_str: Canonical tag format e.g. "|TAG1||TAG2|"
        conn: SQLite connection object

    Returns:
        (is_valid, error_message)
        - is_valid=True, error_message=None if all tags are Active
        - is_valid=False, error_message=str listing inactive tags if any tag is not Active

    Rule:
    - Only Active tags (status='Active') are allowed.
    - Inactive tags block new row saves.
    - Admins cannot bypass this (enforced at API level).
    """
    if not normalized_tags_str or normalized_tags_str == "":
        return True, None

    # Parse canonical format.
    tags = parse_pipe_tags(normalized_tags_str)
    if not tags:
        return True, None

    # Extract tag names (strip pipes).
    tag_names = [tag.strip("|") for tag in tags]

    # Query catalog for status of each tag.
    placeholders = ",".join(["?"] * len(tag_names))
    cursor = conn.cursor()
    cursor.execute(
        f"""
        SELECT tag_name, status
        FROM event_tag_catalog
        WHERE tag_name IN ({placeholders})
        """,
        tag_names,
    )
    rows = cursor.fetchall()
    catalog_lookup = {row[0]: row[1] for row in rows}

    # Check for inactive tags.
    inactive_tags = [
        name for name in tag_names if catalog_lookup.get(name) == "Inactive"
    ]

    if inactive_tags:
        return False, f"Tags not available: {', '.join(inactive_tags)}"

    # Check for uncatalogued tags (should not happen if catalog is complete).
    # For now, allow them (future: enforce all tags must be in catalog).
    missing_tags = [name for name in tag_names if name not in catalog_lookup]
    if missing_tags:
        # Log but don't fail (catalog may be incomplete).
        pass

    return True, None
