"""Ignored LightFM artifact serialization with integrity metadata."""
from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any


def save_bundle(path: Path, bundle: dict[str, Any]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(pickle.dumps(bundle, protocol=pickle.HIGHEST_PROTOCOL))
    return path.stat().st_size


def load_bundle(path: Path) -> dict[str, Any]:
    value = pickle.loads(path.read_bytes())
    if value.get("artifact_version") != "slice-3-lightfm-v1":
        raise ValueError("unsupported model artifact")
    return value
