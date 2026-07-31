"""Slice 2 offline evaluation-readiness CLI. Deliberately contains no model code."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import time
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from .baselines import popularity, rank_global, rank_interest
from .candidate_universe import CandidateUniverse
from .catalog_snapshot import load_snapshot
from .evaluation_splits import assert_no_mask_leak, build_masks
from .feature_audit import audit_features
from .scenario_evaluation import build_scenarios

ROOT = Path(__file__).resolve().parents[2]
GENERATED = ROOT / "ml/recommendation/generated"
SEEDS = (11, 29, 47)
DOMAINS = ("material", "project")


def metrics(ranked: list[str], targets: set[str]) -> dict[str, float]:
    result: dict[str, float] = {}
    for k in (5, 10):
        top = ranked[:k]
        hits = [1 if item in targets else 0 for item in top]
        denom = min(k, len(ranked))
        result[f"precision@{k}"] = sum(hits) / denom if denom else 0.0
        result[f"recall@{k}"] = sum(hits) / len(targets) if targets else 0.0
        dcg = sum(hit / math.log2(index + 2) for index, hit in enumerate(hits))
        ideal = sum(1 / math.log2(index + 2) for index in range(min(len(targets), denom)))
        result[f"ndcg@{k}"] = dcg / ideal if ideal else 0.0
        result[f"hit_rate@{k}"] = float(any(hits))
    result["mrr"] = next((1 / (i + 1) for i, item in enumerate(ranked) if item in targets), 0.0)
    return result


def _load_seed(seed: int) -> dict[str, list[dict[str, Any]]]:
    folder = GENERATED / f"seed-{seed}"
    names = ("personas", "impressions", "material-interactions", "project-interactions")
    return {name.replace("-", "_"): pq.read_table(folder / f"{name}.parquet").to_pylist() for name in names}


def _quantiles(values: list[float]) -> dict[str, float]:
    if not values: return {"p25": 0.0, "median": 0.0, "p75": 0.0}
    values = sorted(values)
    pick = lambda q: values[round((len(values) - 1) * q)]
    return {"p25": pick(.25), "median": median(values), "p75": pick(.75)}


def _sufficiency(rows: list[dict[str, Any]], item_count: int) -> dict[str, Any]:
    pairs = {(r["sim_user_key"], r["entity_key"]) for r in rows}
    by_user: dict[str, set[str]] = defaultdict(set); by_item: dict[str, set[str]] = defaultdict(set)
    for user, item in pairs: by_user[user].add(item); by_item[item].add(user)
    unseen = [item_count - len(items) for items in by_user.values()]
    saturation = {str(p): sum(len(items) / item_count > p for items in by_user.values()) for p in (.5, .7, .8, .9)}
    return {
        "users_with_train_positives": len({r["sim_user_key"] for r in rows if r["split"] == "train"}),
        "validation_test_eligible_users": len({r["sim_user_key"] for r in rows if r["split"] != "train"}),
        "positives_by_split": dict(Counter(r["split"] for r in rows)), "unique_pairs": len(pairs),
        "density": len(pairs) / max(1, 300 * item_count),
        "candidate_count_distribution": {"minimum": min(unseen, default=item_count), "median": median(unseen) if unseen else item_count, "maximum": max(unseen, default=item_count)},
        "items_with_users": {str(n): sum(len(v) >= n for v in by_item.values()) for n in (2, 3, 5)},
        "users_with_items": {str(n): sum(len(v) >= n for v in by_user.values()) for n in (2, 5, 10)},
        "users_above_catalog_share": saturation,
        "users_no_unseen_candidate": sum(v == 0 for v in unseen),
        "users_fewer_than_5_unseen": sum(v < 5 for v in unseen),
        "users_fewer_than_10_unseen": sum(v < 10 for v in unseen),
        "support_status": "INSUFFICIENT_SYNTHETIC_SUPPORT" if item_count <= 30 and (sum(v < 10 for v in unseen) > len(unseen) * .25) else "SUPPORTED",
    }


def run() -> dict[str, Any]:
    started = time.perf_counter()
    catalog = load_snapshot(GENERATED / "catalog-snapshot")
    feature_audit = audit_features(catalog)
    (GENERATED / "evaluation").mkdir(parents=True, exist_ok=True)
    output: dict[str, Any] = {"snapshot_hash": catalog["summary"]["content_hash"], "feature_audit": feature_audit, "seeds": {}}
    mask_rows: list[dict[str, Any]] = []; recommendation_rows: list[dict[str, Any]] = []
    scenario_seed: tuple[dict[str, str], list[str], int] | None = None
    for seed in SEEDS:
        data = _load_seed(seed); personas = {p["sim_user_key"]: p for p in data["personas"]}
        universe = CandidateUniverse(catalog, data["impressions"]); seed_out: dict[str, Any] = {}
        for domain in DOMAINS:
            items = catalog[f"{domain}s"]
            key_field = f"{domain}_key"; metadata = {r[key_field]: r for r in items}
            rows = data[f"{domain}_interactions"]
            complete = {key for key, row in metadata.items() if row["category_key"] and row["publication_timestamp"]}
            mask = build_masks(rows, complete, seed, domain); assert_no_mask_leak(mask)
            for kind, values in (("EVALUATION_MASKED_COLD_USER", mask["masked_users"]), ("EVALUATION_MASKED_COLD_ITEM", mask["masked_items"])):
                mask_rows.extend({"seed": seed, "domain": domain, "cohort": kind, "key": value} for value in values)
            train = [r for r in mask["training_view"] if r["split"] == "train"]
            scores = popularity(train); train_seen: dict[str, set[str]] = defaultdict(set)
            for row in train: train_seen[row["sim_user_key"]].add(row["entity_key"])
            later: dict[str, set[str]] = defaultdict(set); latest: dict[str, str] = {}
            for row in rows:
                if row["split"] != "train":
                    later[row["sim_user_key"]].add(row["entity_key"])
                    latest[row["sim_user_key"]] = max(latest.get(row["sim_user_key"], ""), row["timestamp_utc"])
            per_model: dict[str, list[dict[str, float]]] = {"global_popularity": [], "interest_category_popularity": []}
            per_user: dict[str, dict[str, dict[str, float]]] = {}
            candidates_audit: list[int] = []
            exposure_results: dict[str, list[float]] = defaultdict(list)
            recommended: dict[str, set[str]] = defaultdict(set)
            recommendation_counts: dict[str, Counter[str]] = defaultdict(Counter)
            identical_top_five = 0
            for user in sorted(later):
                candidates = universe.candidates(user, domain, latest[user], train_seen[user])
                candidates_audit.append(len(candidates))
                global_rank = rank_global(candidates, scores)
                interest_rank = rank_interest(candidates, scores, personas[user], metadata)
                if set(global_rank) != set(interest_rank): raise ValueError("baselines received different candidates")
                per_user[user] = {}
                for model, ranking in (("global_popularity", global_rank), ("interest_category_popularity", interest_rank)):
                    value = metrics(ranking, later[user]); per_model[model].append(value); per_user[user][model] = value
                    recommended[model].update(ranking[:10]); recommendation_counts[model].update(ranking[:10])
                    recommendation_rows.extend({"seed": seed, "domain": domain, "user": user, "baseline": model, "rank": i + 1, "entity_key": item} for i, item in enumerate(ranking[:10]))
                for source in (None, "POLICY_SELECTED", "RANDOM_EXPLORATION"):
                    diag = universe.candidates(user, domain, latest[user], train_seen[user], "DIAGNOSTIC", source)
                    exposure_results[source or "ALL_EXPOSED"].append(metrics(rank_global(diag, scores), later[user])["ndcg@10"])
                identical_top_five += global_rank[:5] == interest_rank[:5]
            aggregate = {model: {metric: sum(v[metric] for v in values) / max(1, len(values)) for metric in ("precision@5", "precision@10", "recall@5", "recall@10", "ndcg@5", "ndcg@10", "mrr", "hit_rate@5", "hit_rate@10")} for model, values in per_model.items()}
            deltas = [values["interest_category_popularity"]["ndcg@10"] - values["global_popularity"]["ndcg@10"] for values in per_user.values()]
            paired = {"eligible_users": len(deltas), "improved": sum(d > 0 for d in deltas), "regressed": sum(d < 0 for d in deltas), "unchanged": sum(d == 0 for d in deltas), **_quantiles(deltas)}
            paired["percentages"] = {key: round(100 * paired[key] / max(1, len(deltas)), 3) for key in ("improved", "regressed", "unchanged")}
            paired["by_cohort"] = {cohort: _quantiles([per_user[u]["interest_category_popularity"]["ndcg@10"] - per_user[u]["global_popularity"]["ndcg@10"] for u in per_user if personas[u]["cohort"] == cohort]) for cohort in sorted({p["cohort"] for p in personas.values()})}
            paired["by_activity"] = {band: _quantiles([per_user[u]["interest_category_popularity"]["ndcg@10"] - per_user[u]["global_popularity"]["ndcg@10"] for u in per_user if personas[u]["activity_band"] == band]) for band in ("low", "medium", "high")}
            long_tail = set(sorted(metadata, key=lambda item: (scores[item], item))[:max(1, round(.8 * len(metadata)))])
            popularity_diagnostics = {}
            for model, counts in recommendation_counts.items():
                total = sum(counts.values())
                popularity_diagnostics[model] = {
                    "long_tail_coverage": len(recommended[model] & long_tail) / max(1, len(long_tail)),
                    "average_recommended_popularity": sum(scores[item] * count for item, count in counts.items()) / max(1, total),
                    "popularity_concentration": sum((count / total) ** 2 for count in counts.values()) if total else 0.0,
                }
            seed_out[domain] = {
                "natural_cold_users": len(mask["natural_cold_users"]), "natural_cold_items": len(mask["natural_cold_items"]),
                "masked_cold_users": len(mask["masked_users"]), "masked_cold_items": len(mask["masked_items"]), "mask_status": mask["status"],
                "data_sufficiency": _sufficiency(rows, len(items)), "candidate_counts": {"min": min(candidates_audit, default=0), "median": median(candidates_audit) if candidates_audit else 0, "max": max(candidates_audit, default=0)},
                "metrics": aggregate, "paired_ndcg10": paired,
                "coverage": {model: len(values) / len(items) for model, values in recommended.items()},
                "popularity_diagnostics": popularity_diagnostics,
                "identical_top_five_rate": identical_top_five / max(1, len(per_user)),
                "exposure_diagnostic_ndcg10": {k: sum(v) / max(1, len(v)) for k, v in exposure_results.items()},
                "precision_denominator": "min(K, eligible candidate count); users with zero candidates score zero",
            }
            if seed == 11 and domain == "material":
                label_map = {key: row["category_label"] for key, row in metadata.items()}
                scenario_seed = (label_map, rank_global(sorted(metadata), scores), len(metadata))
        output["seeds"][str(seed)] = seed_out
    output["scenarios"] = build_scenarios(*scenario_seed) if scenario_seed else []
    output["runtime_seconds"] = round(time.perf_counter() - started, 6)
    output["logical_hash"] = hashlib.sha256(json.dumps(output, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    out = GENERATED / "evaluation"
    (out / "feature-audit.json").write_text(json.dumps(feature_audit, indent=2, sort_keys=True))
    (out / "baseline-metrics.json").write_text(json.dumps(output, indent=2, sort_keys=True))
    (out / "scenario-results.json").write_text(json.dumps(output["scenarios"], indent=2, sort_keys=True))
    pq.write_table(pa.Table.from_pylist(mask_rows), out / "cold-start-masks.parquet")
    pq.write_table(pa.Table.from_pylist(recommendation_rows), out / "baseline-recommendations.parquet")
    return output


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--validate-only", action="store_true"); args = parser.parse_args()
    first = run()
    if not args.validate_only:
        second = run()
        # Runtime is engineering evidence, not logical data.
        for value in (first, second): value.pop("runtime_seconds", None); value.pop("logical_hash", None)
        if first != second: raise ValueError("evaluation logical determinism failed")
    print(json.dumps({"status": "PASS", "snapshot_hash": first["snapshot_hash"]}))
    return 0


if __name__ == "__main__": raise SystemExit(main())
