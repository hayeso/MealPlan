"""Shared quantity formatting for grocery, prep, and today views."""
from __future__ import annotations

from collections import defaultdict


def format_quantity(qty: float | None, unit: str | None) -> str:
    if qty is None:
        return "as needed"
    q = round(qty, 2)
    if q == int(q):
        q = int(q)
    return f"{q} {unit}" if unit else str(q)


def format_quantity_totals(
    quantities: list[tuple[float | None, str | None]],
    *,
    null_label: str = "as needed",
    partial_null_suffix: str = "+ some",
) -> str:
    by_unit: dict[str | None, float] = defaultdict(float)
    has_null_qty = False
    for qty, unit in quantities:
        if qty is None:
            has_null_qty = True
        else:
            by_unit[unit] += qty

    parts: list[str] = []
    for unit, total in sorted(by_unit.items(), key=lambda x: x[0] or ""):
        parts.append(format_quantity(total, unit))

    if has_null_qty and not parts:
        parts.append(null_label)
    elif has_null_qty:
        parts.append(partial_null_suffix)

    return ", ".join(parts)
