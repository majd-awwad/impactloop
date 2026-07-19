"""Strict Linux-side loader for the sanitized Windows catalog snapshot."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .privacy import require_hash, scan_records
from .schemas import (
    CATALOG_ORIGIN, MATERIAL_FIELDS, PROJECT_FIELDS, SNAPSHOT_SCHEMA_VERSION,
)


def _logical_hash(materials: list[dict[str, Any]], projects: list[dict[str, Any]]) -> str:
    payload = json.dumps([materials, projects], ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def load_snapshot(directory: Path) -> dict[str, Any]:
    material_doc = json.loads((directory / "materials.json").read_text())
    project_doc = json.loads((directory / "projects.json").read_text())
    summary = json.loads((directory / "catalog-summary.json").read_text())
    materials, projects = material_doc["rows"], project_doc["rows"]
    for doc in (material_doc, project_doc):
        meta = doc["metadata"]
        if meta["origin"] != CATALOG_ORIGIN or meta["schema_version"] != SNAPSHOT_SCHEMA_VERSION:
            raise ValueError("unsupported or non-catalog snapshot")
    for row in materials:
        if set(row) != MATERIAL_FIELDS:
            raise ValueError(f"unexpected material fields: {sorted(set(row) ^ MATERIAL_FIELDS)}")
        require_hash(row["material_key"], "material_key")
        require_hash(row["category_key"], "category_key")
        if row["public_state"] != "AVAILABLE":
            raise ValueError("non-public material")
        datetime.fromisoformat(row["publication_timestamp"].replace("Z", "+00:00"))
    for row in projects:
        if set(row) != PROJECT_FIELDS:
            raise ValueError(f"unexpected project fields: {sorted(set(row) ^ PROJECT_FIELDS)}")
        require_hash(row["project_key"], "project_key")
        require_hash(row["category_key"], "category_key")
        if row["public_state"] != "PUBLISHED":
            raise ValueError("non-public project")
        datetime.fromisoformat(row["publication_timestamp"].replace("Z", "+00:00"))
    violations = scan_records([*materials, *projects])
    if violations:
        raise ValueError("; ".join(violations))
    if len({r["material_key"] for r in materials}) != len(materials):
        raise ValueError("duplicate material keys")
    if len({r["project_key"] for r in projects}) != len(projects):
        raise ValueError("duplicate project keys")
    actual = _logical_hash(materials, projects)
    if actual != summary["content_hash"]:
        raise ValueError("snapshot content hash mismatch")
    return {"materials": materials, "projects": projects, "summary": summary}

