from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import pytest

from ml.recommendation.catalog_snapshot import _logical_hash, load_snapshot
from ml.recommendation.privacy import scan_records

ROOT = Path(__file__).resolve().parents[3]
EXPORTER = ROOT / "ml/recommendation/catalog_export_windows.ts"


def test_exporter_has_fixed_allowlist_and_read_only_transaction() -> None:
    source = EXPORTER.read_text()
    assert "SET default_transaction_read_only = on" in source
    assert 'client.query("BEGIN READ ONLY")' in source
    assert 'client.query("ROLLBACK")' in source
    assert "Only SELECT statements are allowed" in source
    for prohibited in ("users", "reservations", "recommendation_actions"):
        assert f'"{prohibited}"' in source
    assert not any(token in source for token in ("INSERT INTO", "UPDATE materials", "DELETE FROM"))


def test_namespaced_hash_contract_is_explicit() -> None:
    source = EXPORTER.read_text()
    assert "impactloop-${namespace}:${id}" in source
    assert hashlib.sha256(b"impactloop-material:invented-id").hexdigest() != hashlib.sha256(
        b"impactloop-project:invented-id"
    ).hexdigest()


def test_real_snapshot_schema_privacy_hash_and_ignore() -> None:
    directory = ROOT / "ml/recommendation/generated/catalog-snapshot"
    catalog = load_snapshot(directory)
    assert catalog["materials"] and catalog["projects"]
    assert scan_records([*catalog["materials"], *catalog["projects"]]) == []
    assert catalog["summary"]["database_write_count"] == 0
    assert catalog["summary"]["session_read_only"] is True
    assert catalog["summary"]["explicit_read_only_transaction"] is True
    assert _logical_hash(catalog["materials"], catalog["projects"]) == catalog["summary"]["content_hash"]
    for name in ("materials.json", "projects.json", "catalog-summary.json"):
        result = subprocess.run(
            ["git", "check-ignore", str(directory / name)], cwd=ROOT, capture_output=True
        )
        assert result.returncode == 0


def test_loader_rejects_unexpected_or_raw_identifier(tmp_path: Path) -> None:
    fixture = json.loads((Path(__file__).parent / "fixtures/catalog_fixture.json").read_text())
    fixture["materials"][0]["id"] = "raw"
    meta = {
        "origin": "IMPACTLOOP_CATALOG_READ_ONLY_SNAPSHOT",
        "schema_version": "impactloop-catalog-snapshot-v2",
        "content_hash": "unused",
    }
    (tmp_path / "materials.json").write_text(json.dumps({"metadata": meta, "rows": fixture["materials"]}))
    (tmp_path / "projects.json").write_text(json.dumps({"metadata": meta, "rows": fixture["projects"]}))
    (tmp_path / "catalog-summary.json").write_text(json.dumps({"content_hash": "unused"}))
    with pytest.raises(ValueError, match="unexpected material fields"):
        load_snapshot(tmp_path)


def test_tracked_fixture_is_invented_and_has_no_prohibited_fields() -> None:
    fixture = json.loads((Path(__file__).parent / "fixtures/catalog_fixture.json").read_text())
    rows = fixture["materials"] + fixture["projects"]
    assert scan_records(rows) == []
    assert all("invented" in json.dumps(row) for row in rows)
