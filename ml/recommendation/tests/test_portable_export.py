from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from ml.recommendation.export_portable_model import OUT, canonical, export_domain
from ml.recommendation.run_expanded import verify_a

ROOT=Path(__file__).resolve().parents[3]


def test_benchmark_a_hashes_unchanged_and_artifacts_ignored():
    assert verify_a()
    for path in OUT.glob("*.json"):
        assert subprocess.run(["git","check-ignore",str(path)],cwd=ROOT).returncode==0


def test_export_contains_only_metadata_and_valid_content_hash():
    for domain in ("material","project"):
        artifact=json.loads((OUT/f"{domain}-hybrid.json").read_text())
        claimed=artifact.pop("content_hash")
        assert hashlib.sha256(canonical(artifact).encode()).hexdigest()==claimed
        text=json.dumps(artifact)
        assert not any(token in text.lower() for token in ("synthetic_catalog_extension","identity:","material_type","hidden","cohort"))
        assert artifact["domain"]==domain and artifact["feature_schema_version"]=="slice-3-approved-features-v1"


def test_export_is_metadata_only_even_when_source_has_identities():
    artifact=export_domain(11,"material")
    assert artifact["user_features"] and artifact["item_features"]
    assert all(not row["name"].startswith(("user_identity:","item_identity:")) for row in artifact["user_features"]+artifact["item_features"])


def test_no_python_runtime_or_online_update_in_backend_shadow_modules():
    folder=ROOT/"apps/backend/src/modules/recommendations"
    source="\n".join((folder/name).read_text() for name in ("ml-model-artifact.ts","ml-lightfm-scorer.ts","short-term-intent.ts","ml-shadow.service.ts"))
    lowered=source.lower()
    assert "child_process" not in lowered and "fit_partial" not in lowered and "fetch(" not in lowered
