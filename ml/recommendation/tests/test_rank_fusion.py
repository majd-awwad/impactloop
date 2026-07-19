import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pyarrow.parquet as pq

from ml.recommendation.model_io import load_bundle
from ml.recommendation.recommend import rank_lightfm
from ml.recommendation.short_term import fuse_ranks, intent_scores, recent_confidence

ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/"ml/recommendation/generated/benchmark-b"


def test_frozen_casebook_inputs_regress_without_profile_only_degradation():
    bundle=load_bundle(OUT/"models-expanded/material-hybrid.pkl"); users=pq.read_table(OUT/"new-users/personas.parquet").to_pylist(); actions=pq.read_table(OUT/"new-users/staged-actions.parquet").to_pylist()
    originals=json.loads((ROOT/"ml/recommendation/generated/catalog-snapshot/materials.json").read_text())["rows"]
    extension=pq.read_table(OUT/"expanded-catalog/materials.parquet").to_pylist(); items={row["material_key"]:row for row in [*originals,*extension]}; by_user=defaultdict(list)
    for row in actions: by_user[row["sim_user_key"]].append(row)
    stage_order={name:index for index,name in enumerate(("T0_PROFILE_ONLY","T1_EARLY_BROWSING","T2_COHERENT_RECENT_INTENT","T3_STRONG_EVIDENCE","T4_PREFERENCE_DRIFT","T5_DECAY"))}; results=defaultdict(list); confidences=defaultdict(list)
    for user in users:
        long_term=rank_lightfm(bundle["model"],user["sim_user_key"],bundle["mappings"]["items"],bundle["mappings"],bundle["user_features"],bundle["item_features"])
        for stage,day in (("T0_PROFILE_ONLY",0),("T2_COHERENT_RECENT_INTENT",2),("T4_PREFERENCE_DRIFT",5),("T5_DECAY",19)):
            included=[] if stage=="T0_PROFILE_ONLY" else [a for a in by_user[user["sim_user_key"]] if a["domain"]=="material" and stage_order[a["stage"]]<=stage_order[stage]]
            now=(datetime(2026,8,18,20,tzinfo=timezone.utc)+timedelta(days=day)).isoformat().replace("+00:00","Z"); profile=recent_confidence(included,items,now); fused=fuse_ranks(long_term,items,intent_scores(included,items,now),profile["confidence"])
            if stage=="T0_PROFILE_ONLY": assert fused==long_term and profile["confidence"]=="NONE"
            target=user["secondary_interest"] if user["cohort"]=="PREFERENCE_SHIFT" and stage!="T0_PROFILE_ONLY" else user["primary_interest"]
            results[(user["cohort"],stage)].append(sum(items[key]["category_key"]==target for key in fused[:5]))
            confidences[(user["cohort"],stage)].append(profile["confidence"])
    assert len(users)==50
    assert sum(results[("PREFERENCE_SHIFT","T4_PREFERENCE_DRIFT")])/10>=1
    assert "HIGH" not in confidences[("NOISY_ACCIDENTAL","T4_PREFERENCE_DRIFT")]
