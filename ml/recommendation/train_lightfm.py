"""Deterministic single-thread Slice 3 LightFM training and evaluation."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from typing import Any

import lightfm
import numpy as np
import pyarrow.parquet as pq
from lightfm import LightFM

from .baselines import popularity, rank_global, rank_interest
from .candidate_universe import CandidateUniverse
from .catalog_snapshot import load_snapshot
from .evaluate import metrics
from .evaluation_splits import assert_no_mask_leak, build_masks
from .features import FEATURE_SCHEMA_VERSION, feature_matrices, interaction_matrix, mappings
from .model_io import load_bundle, save_bundle
from .recommend import rank_lightfm
from .scenario_evaluation import SCENARIOS

ROOT = Path(__file__).resolve().parents[2]
GENERATED = ROOT / "ml/recommendation/generated"
MODEL_ROOT = GENERATED / "models"
SEEDS = (11, 29, 47); TUNING_SEEDS = (11, 29); DOMAINS = ("material", "project")
SIM_HASHES = {11: "99523dc1037e076b7472358581d7388cec3eb68b777555f8000e6d79879f4eb4", 29: "71307d2e807d2af01833871c43e34e144b06f62dd4674ff825d85585bc035dc5", 47: "86c564cd0aba4b49cd2d4a60e280f2a55f052aff96c0cfd84eeb62c589c8c697"}
GRID = [
    {"no_components": 8, "epochs": 5, "learning_rate": .03, "user_alpha": 0.0, "item_alpha": 0.0},
    {"no_components": 16, "epochs": 10, "learning_rate": .03, "user_alpha": 1e-6, "item_alpha": 1e-6},
    {"no_components": 32, "epochs": 10, "learning_rate": .03, "user_alpha": 1e-6, "item_alpha": 1e-6},
    {"no_components": 16, "epochs": 20, "learning_rate": .01, "user_alpha": 1e-5, "item_alpha": 1e-5},
]


def _seed_data(seed: int):
    folder = GENERATED / f"seed-{seed}"
    names = ("personas", "impressions", "material-interactions", "project-interactions")
    return {n.replace("-", "_"): pq.read_table(folder / f"{n}.parquet").to_pylist() for n in names}


def _prepare(seed: int, domain: str, catalog: dict[str, Any]):
    data = _seed_data(seed); items = catalog[f"{domain}s"]; rows = data[f"{domain}_interactions"]
    complete = {r[f"{domain}_key"] for r in items if r["category_key"] and r["publication_timestamp"]}
    mask = build_masks(rows, complete, seed, domain); assert_no_mask_leak(mask)
    maps = mappings(data["personas"], items, domain)
    return data, items, rows, mask, maps


def _fit(seed: int, cfg: dict[str, Any], interactions, weights, user_features, item_features):
    random.seed(seed); np.random.seed(seed)
    model = LightFM(loss="warp", no_components=cfg["no_components"], learning_rate=cfg["learning_rate"],
                    user_alpha=cfg["user_alpha"], item_alpha=cfg["item_alpha"], random_state=seed)
    started = time.perf_counter()
    model.fit(interactions, sample_weight=weights, user_features=user_features,
              item_features=item_features, epochs=cfg["epochs"], num_threads=1, verbose=False)
    return model, time.perf_counter() - started


def _targets(rows: list[dict[str, Any]], split: str):
    result: dict[str, set[str]] = defaultdict(set); timestamps: dict[str, str] = {}
    for row in rows:
        if row["split"] == split:
            result[row["sim_user_key"]].add(row["entity_key"])
            timestamps[row["sim_user_key"]] = max(timestamps.get(row["sim_user_key"], ""), row["timestamp_utc"])
    return result, timestamps


def _evaluate(model, family: str, split: str, prepared, catalog, matrices, cold_matrices=None,
              universe_name: str = "PRIMARY", source: str | None = None):
    data, items, rows, mask, maps = prepared; user_features, item_features = matrices
    targets, timestamps = _targets(rows, split); universe = CandidateUniverse(catalog, data["impressions"])
    train_rows = [r for r in mask["training_view"] if r["split"] == "train"]
    seen: dict[str, set[str]] = defaultdict(set)
    for r in train_rows: seen[r["sim_user_key"]].add(r["entity_key"])
    by_user = {}; recommendations = {}; predict_seconds = 0.0
    for user in sorted(targets):
        candidates = universe.candidates(user, rows[0]["domain"], timestamps[user], seen[user], universe_name, source)
        uf, itf = user_features, item_features
        if cold_matrices and (user in mask["masked_users"] or targets[user] & set(mask["masked_items"])):
            uf, itf = cold_matrices
        started = time.perf_counter(); ranking = rank_lightfm(model, user, candidates, maps, uf, itf); predict_seconds += time.perf_counter() - started
        by_user[user] = metrics(ranking, targets[user]); recommendations[user] = ranking[:10]
    metric_names = ("precision@5", "precision@10", "recall@5", "recall@10", "ndcg@5", "ndcg@10", "mrr", "hit_rate@5", "hit_rate@10")
    aggregate = {name: sum(x[name] for x in by_user.values()) / max(1, len(by_user)) for name in metric_names}
    all_recs = [item for ranking in recommendations.values() for item in ranking]
    counts = Counter(all_recs); train_pop = popularity(train_rows); tail = set(sorted(maps["items"], key=lambda x: (train_pop[x], x))[:max(1, round(.8 * len(maps["items"])))])
    aggregate.update({
        "catalog_coverage": len(set(all_recs)) / len(maps["items"]),
        "long_tail_coverage": len(set(all_recs) & tail) / len(tail),
        "average_recommended_popularity": sum(train_pop[x] for x in all_recs) / max(1, len(all_recs)),
        "popularity_concentration": sum((n / max(1, len(all_recs))) ** 2 for n in counts.values()),
        "eligible_users": len(by_user), "prediction_seconds": predict_seconds,
    })
    return aggregate, by_user, recommendations


def _cohort_metrics(by_user: dict[str, dict[str, float]], users: set[str], unavailable: bool = False):
    supported = sorted(set(by_user) & users)
    if unavailable:
        return {"status": "UNAVAILABLE_FOR_TRUE_COLD_START", "eligible_users": len(supported)}
    if not supported:
        return {"status": "INSUFFICIENT_SYNTHETIC_SUPPORT", "eligible_users": 0}
    return {"status": "SUPPORTED", "eligible_users": len(supported),
            "ndcg@10": sum(by_user[u]["ndcg@10"] for u in supported) / len(supported),
            "recall@10": sum(by_user[u]["recall@10"] for u in supported) / len(supported)}


def _bootstrap(deltas: list[float], seed: int, rounds: int = 500):
    if not deltas: return {"status": "INSUFFICIENT_SYNTHETIC_SUPPORT"}
    rng = np.random.default_rng(seed); values = np.asarray(deltas); means = []
    for _ in range(rounds): means.append(float(rng.choice(values, len(values), replace=True).mean()))
    means.sort()
    return {"status": "SUPPORTED", "observed_mean": float(values.mean()), "ci95": [means[12], means[487]], "resamples_above_zero": sum(x > 0 for x in means) / rounds, "rounds": rounds}


def _paired(light: dict[str, dict[str, float]], other: dict[str, dict[str, float]], personas: dict[str, dict[str, Any]], seed: int):
    users = sorted(set(light) & set(other)); deltas = [light[u]["ndcg@10"] - other[u]["ndcg@10"] for u in users]
    q = sorted(deltas); pick = lambda p: q[round((len(q) - 1) * p)] if q else 0.0
    result = {"eligible_users": len(users), "improved": sum(x > 0 for x in deltas), "regressed": sum(x < 0 for x in deltas), "unchanged": sum(x == 0 for x in deltas), "mean": sum(deltas) / max(1, len(deltas)), "median": median(deltas) if deltas else 0.0, "p25": pick(.25), "p75": pick(.75), "materially_positive": sum(x >= .05 for x in deltas), "materially_negative": sum(x <= -.05 for x in deltas), "bootstrap": _bootstrap(deltas, seed)}
    result["percentages"] = {k: 100 * result[k] / max(1, len(users)) for k in ("improved", "regressed", "unchanged")}
    result["by_cohort"] = {c: {"status": "SUPPORTED" if len(ds) >= 5 else "INSUFFICIENT_SYNTHETIC_SUPPORT", "count": len(ds), "mean": sum(ds)/max(1,len(ds))} for c in sorted({p["cohort"] for p in personas.values()}) for ds in [[light[u]["ndcg@10"]-other[u]["ndcg@10"] for u in users if personas[u]["cohort"] == c]]}
    result["by_activity"] = {c: {"status": "SUPPORTED" if len(ds) >= 5 else "INSUFFICIENT_SYNTHETIC_SUPPORT", "count": len(ds), "mean": sum(ds)/max(1,len(ds))} for c in ("low","medium","high") for ds in [[light[u]["ndcg@10"]-other[u]["ndcg@10"] for u in users if personas[u]["activity_band"] == c]]}
    return result


def _baseline_users(prepared, catalog, split: str):
    data, items, rows, mask, maps = prepared; target, ts = _targets(rows, split); universe = CandidateUniverse(catalog, data["impressions"])
    train = [r for r in mask["training_view"] if r["split"] == "train"]; scores = popularity(train); seen=defaultdict(set)
    for r in train: seen[r["sim_user_key"]].add(r["entity_key"])
    persona={p["sim_user_key"]:p for p in data["personas"]}; meta={r[f"{rows[0]['domain']}_key"]:r for r in items}
    result={"global":{},"interest":{}}
    for u in sorted(target):
        c=universe.candidates(u,rows[0]["domain"],ts[u],seen[u]); result["global"][u]=metrics(rank_global(c,scores),target[u]); result["interest"][u]=metrics(rank_interest(c,scores,persona[u],meta),target[u])
    return result


def select_config(domain: str, family: str, catalog):
    trials=[]
    for index,cfg in enumerate(GRID):
        values=[]; duration=0.0
        for seed in TUNING_SEEDS:
            prepared=_prepare(seed,domain,catalog); data,items,rows,mask,maps=prepared
            inter,weights=interaction_matrix(mask["training_view"],maps)
            uf,itf,_=feature_matrices(data["personas"],items,domain,maps,True,metadata=family=="hybrid")
            model,fit_s=_fit(seed*100+index,cfg,inter,weights,uf,itf); duration+=fit_s
            result,_,_=_evaluate(model,family,"validation",prepared,catalog,(uf,itf)); values.append(result["ndcg@10"])
        trials.append({"config":cfg,"validation_ndcg10":sum(values)/len(values),"seed_values":values,"fit_seconds":duration})
    trials.sort(key=lambda x:(-x["validation_ndcg10"],json.dumps(x["config"],sort_keys=True)))
    return trials[0]["config"], trials


def run():
    os.environ.setdefault("PYTHONHASHSEED","0"); catalog=load_snapshot(GENERATED/"catalog-snapshot")
    selected={}; search={}
    for domain in DOMAINS:
        selected[domain]={}; search[domain]={}
        for family in ("pure","hybrid"):
            selected[domain][family],search[domain][family]=select_config(domain,family,catalog)
    # Selection is now frozen; Seed 47 is first accessed below.
    results={}; artifacts={}; scenario_results=[]
    for seed in SEEDS:
        results[str(seed)]={}
        for domain in DOMAINS:
            prepared=_prepare(seed,domain,catalog); data,items,rows,mask,maps=prepared; results[str(seed)][domain]={}
            inter,weights=interaction_matrix(mask["training_view"],maps)
            baselines=_baseline_users(prepared,catalog,"test"); persona={p["sim_user_key"]:p for p in data["personas"]}
            for family in ("pure","hybrid"):
                metadata=family=="hybrid"; uf,itf,schema=feature_matrices(data["personas"],items,domain,maps,True,metadata=metadata)
                cold=(None,None)
                if family=="hybrid": cold_uf,cold_itf,_=feature_matrices(data["personas"],items,domain,maps,True,set(mask["masked_users"]),set(mask["masked_items"]),True); cold=(cold_uf,cold_itf)
                model,fit_s=_fit(seed,selected[domain][family],inter,weights,uf,itf)
                aggregate,users,recs=_evaluate(model,family,"test",prepared,catalog,(uf,itf),cold if family=="hybrid" else None)
                diagnostic = {}
                for label, source in (("all_exposed", None), ("policy_selected", "POLICY_SELECTED"), ("randomized_exploration", "RANDOM_EXPLORATION")):
                    dm, _, _ = _evaluate(model, family, "test", prepared, catalog, (uf,itf), cold if family=="hybrid" else None, "DIAGNOSTIC", source)
                    diagnostic[label] = {"ndcg@10": dm["ndcg@10"], "recall@10": dm["recall@10"], "eligible_users": dm["eligible_users"]}
                paired={name:_paired(users,value,persona,seed+(0 if name=="global" else 1000)) for name,value in baselines.items()}
                path=MODEL_ROOT/f"seed-{seed}"/f"{domain}-{family}.pkl"; probe_user=sorted(recs)[0]; probe_candidates=recs[probe_user]
                bundle={"artifact_version":"slice-3-lightfm-v1","model":model,"mappings":maps,"user_features":uf,"item_features":itf,"feature_schema":schema,"feature_schema_version":FEATURE_SCHEMA_VERSION,"snapshot_hash":catalog["summary"]["content_hash"],"simulator_hash":SIM_HASHES[seed],"mapping_hash":maps["mapping_hash"],"hyperparameters":selected[domain][family],"trained_at_utc":datetime.now(timezone.utc).isoformat(),"probe":{"user":probe_user,"candidates":probe_candidates,"ranking":rank_lightfm(model,probe_user,probe_candidates,maps,uf,itf)}}
                ser=time.perf_counter(); size=save_bundle(path,bundle); ser_s=time.perf_counter()-ser; loaded=load_bundle(path)
                if rank_lightfm(loaded["model"],probe_user,probe_candidates,maps,uf,itf)!=bundle["probe"]["ranking"]: raise ValueError("serialization prediction parity")
                aggregate.update({"fit_seconds":fit_s,"serialization_seconds":ser_s,"model_size_bytes":size,"interaction_shape":inter.shape,"interaction_nnz":inter.nnz,"user_feature_shape":uf.shape,"item_feature_shape":itf.shape,"weight_min":float(weights.data.min()),"weight_median":float(np.median(weights.data)),"weight_max":float(weights.data.max())})
                test_targets,_ = _targets(rows,"test")
                masked_item_users={u for u,targets in test_targets.items() if targets & set(mask["masked_items"])}
                natural_item_users={u for u,targets in test_targets.items() if targets & set(mask["natural_cold_items"])}
                cold_start={
                    "masked_users":_cohort_metrics(users,set(mask["masked_users"]),family=="pure"),
                    "masked_items":_cohort_metrics(users,masked_item_users,family=="pure"),
                    "natural_users":_cohort_metrics(users,set(mask["natural_cold_users"]),family=="pure"),
                    "natural_items":_cohort_metrics(users,natural_item_users,family=="pure"),
                    "representation":"UNAVAILABLE_FOR_TRUE_COLD_START" if family=="pure" else "METADATA_ONLY_REPRESENTATION",
                    "masked_item_catalog_count":len(mask["masked_items"]), "natural_item_catalog_count":len(mask["natural_cold_items"]),
                }
                results[str(seed)][domain][family]={"metrics":aggregate,"diagnostic_exposure_metrics":diagnostic,"paired":paired,"cold_start":cold_start}
                artifacts[f"{seed}:{domain}:{family}"]=str(path.relative_to(ROOT))
            if seed==11 and domain=="material":
                # Recent scenario events do not alter a fixed LightFM representation before retraining.
                labels={r["material_key"]:r["category_label"] for r in items}; meta={r["material_key"]:r for r in items}; first_user=sorted(persona)[0]
                scenario_scores=popularity([r for r in mask["training_view"] if r["split"]=="train"])
                global_rank=rank_global(maps["items"],scenario_scores)
                interest_ranked=rank_interest(maps["items"],scenario_scores,persona[first_user],meta)
                for name in SCENARIOS:
                    row={"scenario":name,"long_term_profile":[labels.get(results and items[0]["material_key"],items[0]["category_label"])],"recent_behavior_summary":"CONTROLLED_SYNTHETIC_SCENARIO; NO_RETRAIN","candidate_count":len(items),"known_limitation":"Recent behavior does not change this fixed model before retraining.","models":{}}
                    for baseline,ranked in (("global_popularity",global_rank),("interest_category_popularity",interest_ranked)):
                        row["models"][baseline]={"top5_labels":[labels[x] for x in ranked[:5]],"top10_labels":[labels[x] for x in ranked[:10]],"score_source":"training-only baseline"}
                    for family in ("pure","hybrid"):
                        b=load_bundle(ROOT/artifacts[f"11:material:{family}"]); ranked=rank_lightfm(b["model"],first_user,maps["items"],maps,b["user_features"],b["item_features"]); row["models"][family]={"top5_labels":[labels[x] for x in ranked[:5]],"top10_labels":[labels[x] for x in ranked[:10]],"score_source":"LightFM long-term representation"}
                    hybrid=load_bundle(ROOT/artifacts["11:material:hybrid"])
                    cold_uf,cold_itf,_=feature_matrices(data["personas"],items,"material",maps,True,{first_user},set(),True)
                    cold_rank=rank_lightfm(hybrid["model"],first_user,maps["items"],maps,cold_uf,cold_itf)
                    row["models"]["hybrid_cold"]={"top5_labels":[labels[x] for x in cold_rank[:5]],"top10_labels":[labels[x] for x in cold_rank[:10]],"score_source":"LightFM metadata-only user representation"}
                    scenario_results.append(row)
    automatic="ELIGIBLE_FOR_MANUAL_INTEGRATION_REVIEW"
    material_delta=np.mean([results[str(s)]["material"]["hybrid"]["paired"]["interest"]["mean"] for s in SEEDS])
    project_delta=np.mean([results[str(s)]["project"]["hybrid"]["paired"]["interest"]["mean"] for s in SEEDS])
    domain_decisions={"material":"COMPETITIVE" if material_delta>0 else "NOT_COMPETITIVE","project":"COMPETITIVE" if project_delta>0 else "NOT_COMPETITIVE"}
    if all(v!="COMPETITIVE" for v in domain_decisions.values()): automatic="NOT_COMPETITIVE"
    output={"automatic_result":automatic,"domain_decisions":domain_decisions,"selected_hyperparameters":selected,"search":search,"results":results,"scenarios":scenario_results,"artifacts":artifacts,"tuning_seeds":[11,29],"seed47_evaluated_after_freeze":True,"num_threads":1,"pythonhashseed":os.environ["PYTHONHASHSEED"],"lightfm_version":lightfm.__version__}
    MODEL_ROOT.mkdir(parents=True,exist_ok=True)
    for name,value in (("selected-hyperparameters.json",selected),("training-metrics.json",search),("test-metrics.json",output),("recommendation-examples.json",scenario_results)):
        (MODEL_ROOT/name).write_text(json.dumps(value,indent=2,sort_keys=True,default=list))
    return output


def verify_artifacts():
    paths=sorted(MODEL_ROOT.glob("seed-*/*.pkl"));
    if len(paths)!=12: raise ValueError("missing selected model artifacts")
    for path in paths:
        bundle=load_bundle(path); probe=bundle["probe"]
        ranking=rank_lightfm(bundle["model"],probe["user"],probe["candidates"],bundle["mappings"],bundle["user_features"],bundle["item_features"])
        if ranking!=probe["ranking"]: raise ValueError(f"reload parity failed: {path}")
    return len(paths)


def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--verify-artifacts",action="store_true"); args=parser.parse_args()
    if args.verify_artifacts: print(json.dumps({"status":"PASS","reloaded_models":verify_artifacts()}))
    else:
        value=run(); print(value["automatic_result"])
    return 0


if __name__=="__main__": raise SystemExit(main())
