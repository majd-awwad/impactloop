"""CLI for Slice 1B generation and validation. It never connects to PostgreSQL."""
from __future__ import annotations

import argparse
import json
import os
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq
import yaml

from .catalog_snapshot import load_snapshot
from .privacy import scan_records
from .schemas import SYNTHETIC_ORIGIN
from .simulator import logical_hash, simulate

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "ml/recommendation/config/simulation.yaml"


def _load_config() -> dict[str, Any]:
    return yaml.safe_load(CONFIG_PATH.read_text())


def _summary(data: dict[str, list[dict[str, Any]]], seed: int, elapsed: float) -> dict[str, Any]:
    impressions, actions = data["impressions"], data["actions"]
    feedback = data["material_interactions"] + data["project_interactions"]
    split_counts = Counter(r["split"] for r in feedback)
    random_share = sum(r["source"] == "RANDOM_EXPLORATION" for r in impressions) / max(1, len(impressions))
    by_user: dict[str, set[str]] = defaultdict(set)
    by_item: dict[str, set[str]] = defaultdict(set)
    for row in feedback:
        by_user[row["sim_user_key"]].add(row["entity_key"])
        by_item[row["entity_key"]].add(row["sim_user_key"])
    return {
        "seed": seed, "variant": _load_config()["variants"].get(seed, _load_config()["variants"].get(str(seed))),
        "logical_hash": logical_hash(data), "row_counts": {k: len(v) for k, v in data.items()},
        "split_positive_counts": dict(split_counts), "randomized_exposure_share": random_share,
        "policy_selected_impressions": sum(r["source"] == "POLICY_SELECTED" for r in impressions),
        "random_exploration_impressions": sum(r["source"] == "RANDOM_EXPLORATION" for r in impressions),
        "engaged_exposures": sum(r["engaged"] for r in impressions),
        "non_engaged_exposures": sum(not r["engaged"] for r in impressions),
        "action_types": dict(Counter(r["action_type"] for r in actions)),
        "persona_cohorts": dict(Counter(r["cohort"] for r in data["personas"])),
        "persona_interests": dict(Counter(r["primary_interest"] for r in data["personas"])),
        "persona_locations": dict(Counter(r["location_bucket"] for r in data["personas"])),
        "persona_activity": dict(Counter(r["activity_band"] for r in data["personas"])),
        "users_with_unique_items": {str(n): sum(len(v) >= n for v in by_user.values()) for n in (2, 5, 10)},
        "items_with_unique_users": {str(n): sum(len(v) >= n for v in by_item.values()) for n in (2, 3, 5)},
        "generation_seconds": round(elapsed, 6),
    }


def validate(data: dict[str, list[dict[str, Any]]], cfg: dict[str, Any], seed: int) -> None:
    if len(data["personas"]) != 300:
        raise ValueError("persona count")
    behavior = [r for name, rows in data.items() if name != "hidden_state" for r in rows]
    if any(r.get("origin") != SYNTHETIC_ORIGIN for r in behavior):
        raise ValueError("non-synthetic behavior row")
    if scan_records(behavior):
        raise ValueError("privacy scan failed")
    impressions = {r["impression_key"]: r for r in data["impressions"]}
    for action in data["actions"]:
        imp = impressions.get(action["impression_key"])
        if not imp or action["timestamp_utc"] <= imp["timestamp_utc"]:
            raise ValueError("exposure ordering")
        for key in ("sim_user_key", "entity_key", "domain", "split"):
            if action[key] != imp[key]:
                raise ValueError("action/impression mismatch")
    share = sum(r["source"] == "RANDOM_EXPLORATION" for r in impressions.values()) / max(1, len(impressions))
    if not .10 <= share <= .21:
        raise ValueError(f"exploration share {share}")
    operation_splits: dict[str, set[str]] = defaultdict(set)
    for action in data["actions"]:
        operation_splits[action["operation_key"]].add(action["split"])
    if any(len(value) != 1 for value in operation_splits.values()):
        raise ValueError("durable chain crosses split")
    if any(p["cohort"] == "stable" and any(e["sim_user_key"] == p["sim_user_key"] for e in data["hidden_state"])
           for p in data["personas"]):
        raise ValueError("stable drift")
    resolved_ops = {r["operation_key"] for r in data["material_interactions"] + data["project_interactions"]}
    if not resolved_ops <= set(operation_splits):
        raise ValueError("raw/resolved reconciliation")


def generate(seed: int, write: bool = True) -> dict[str, Any]:
    cfg = _load_config()
    if seed not in cfg["seeds"]:
        raise ValueError("unsupported seed")
    os.environ.setdefault("PYTHONHASHSEED", "0")
    catalog = load_snapshot(ROOT / cfg["catalog_snapshot_dir"])
    started = time.perf_counter()
    data = simulate(catalog, cfg, seed)
    validate(data, cfg, seed)
    summary = _summary(data, seed, time.perf_counter() - started)
    if write:
        out = ROOT / cfg["artifact_root"] / f"seed-{seed}"
        out.mkdir(parents=True, exist_ok=True)
        write_started = time.perf_counter()
        for name, rows in data.items():
            pq.write_table(pa.Table.from_pylist(rows), out / f"{name.replace('_', '-')}.parquet")
        (out / "dataset-summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True))
        summary["parquet_write_seconds"] = round(time.perf_counter() - write_started, 6)
        summary["artifact_sizes_bytes"] = {p.name: p.stat().st_size for p in sorted(out.iterdir())}
        (out / "dataset-summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True))
    return {"data": data, "summary": summary}


def validate_artifacts(seed: int) -> None:
    cfg = _load_config()
    load_snapshot(ROOT / cfg["catalog_snapshot_dir"])
    out = ROOT / cfg["artifact_root"] / f"seed-{seed}"
    names = ["personas", "impressions", "actions", "material-interactions",
             "project-interactions", "splits", "hidden-state"]
    data = {name.replace("-", "_"): pq.read_table(out / f"{name}.parquet").to_pylist() for name in names}
    validate(data, cfg, seed)
    saved = json.loads((out / "dataset-summary.json").read_text())
    if logical_hash(data) != saved["logical_hash"]:
        raise ValueError("artifact logical hash mismatch")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, required=True, choices=[11, 29, 47])
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    if args.validate_only:
        validate_artifacts(args.seed)
        print(json.dumps({"status": "PASS", "seed": args.seed, "mode": "validation-only"}))
    else:
        first = generate(args.seed)
        second = generate(args.seed, write=False)
        if first["summary"]["logical_hash"] != second["summary"]["logical_hash"]:
            raise ValueError("same-seed logical determinism failed")
        print(json.dumps({"status": "PASS", **first["summary"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
