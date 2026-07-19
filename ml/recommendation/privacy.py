"""Privacy checks shared by snapshot validation and generated artifacts."""
from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from typing import Any

from .schemas import PROHIBITED_FIELDS

EMAIL_RE = re.compile(r"\b[^\s@]+@[^\s@]+\.[^\s@]+\b")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\s-]?){8,15}(?!\d)")
URI_RE = re.compile(r"postgres(?:ql)?://", re.I)
HASH_RE = re.compile(r"^[0-9a-f]{64}$")


def scan_records(records: Iterable[Mapping[str, Any]]) -> list[str]:
    violations: list[str] = []
    for index, row in enumerate(records):
        lowered = {str(key).lower() for key in row}
        bad = sorted(lowered & PROHIBITED_FIELDS)
        if bad:
            violations.append(f"row {index} prohibited fields: {bad}")
        text = " ".join(str(value) for value in row.values())
        if EMAIL_RE.search(text):
            violations.append(f"row {index} email-like value")
        if any(isinstance(value, str) and PHONE_RE.fullmatch(value.strip()) for value in row.values()):
            violations.append(f"row {index} phone-like value")
        if URI_RE.search(text):
            violations.append(f"row {index} connection URI")
    return violations


def require_hash(value: str, label: str) -> None:
    if not HASH_RE.fullmatch(value):
        raise ValueError(f"{label} is not a namespaced SHA-256 key")
