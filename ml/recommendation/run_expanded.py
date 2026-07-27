"""Slice 3B independent expanded-catalog/new-user stress benchmark."""
from __future__ import annotations

import hashlib
import json
import os
import pickle
import copy
import random
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
from lightfm import LightFM
from scipy import sparse

from .baselines import popularity
from .candidate_universe import CandidateUniverse
from .catalog_snapshot import load_snapshot
from .evaluate import metrics
from .expanded_catalog import ORIGIN, audit_extension, generate_extension
from .features import feature_matrices, interaction_matrix, mappings
from .model_io import save_bundle
from .recommend import rank_lightfm
from .short_term import intent_scores, rerank, score_item
from .simulator import logical_hash, simulate

ROOT=Path(__file__).resolve().parents[2]; GENERATED=ROOT/"ml/recommendation/generated"; OUT=GENERATED/"benchmark-b"
NEW_ORIGIN="SYNTHETIC_NEW_USER_EVALUATION"; HOLDOUT="EXPANDED_BENCHMARK_FINAL_HOLDOUT"
BENCHMARK_A_HASHES={
"catalog-snapshot/materials.json":"7bdd64d45f7f8e1e2e97cb5779f5279b4804264a10056379e54d9354a08c68dd",
"catalog-snapshot/projects.json":"ac47ea038cf2ba7e3fd1d60cf34767a924153a7707e9a1cf418afa139d73c4d1",
"seed-11/dataset-summary.json":"0bf61e30a364fd04385ab3d9e85c3d176a6a192e397ac50d80a34fe933b8e2e6",
"seed-29/dataset-summary.json":"07a0a647e6d99f0e05b0dec3fba689a4638e3f7ac299f0dd1a1367a78afbac65",
"seed-47/dataset-summary.json":"402242d26f738ee18774249c7d48aefb429244dd5374e8c015ebef497dea1ca2",
"models/selected-hyperparameters.json":"3b94dcf4552775ac7aaa2c9d52d5519061844e4b37ec61cf37d83290390f04bf",
"models/test-metrics.json":"a828f60ee5aae1df09be926eb7684f86fea787b3bd54c9341cc913610471553f"}
FROZEN={"material":{"no_components":16,"epochs":10,"learning_rate":.03,"user_alpha":1e-6,"item_alpha":1e-6},"project":{"no_components":32,"epochs":10,"learning_rate":.03,"user_alpha":1e-6,"item_alpha":1e-6}}
STAGES=("T0_PROFILE_ONLY","T1_EARLY_BROWSING","T2_COHERENT_RECENT_INTENT","T3_STRONG_EVIDENCE","T4_PREFERENCE_DRIFT","T5_DECAY")


def verify_a():
    actual={name:hashlib.sha256((GENERATED/name).read_bytes()).hexdigest() for name in BENCHMARK_A_HASHES}
    if actual!=BENCHMARK_A_HASHES: raise ValueError("Benchmark A artifact changed")
    return actual


def _write(name:str,rows:list[dict[str,Any]]):
    path=OUT/name; path.parent.mkdir(parents=True,exist_ok=True); pq.write_table(pa.Table.from_pylist(rows),path)


def _training_config():
    cfg=json.loads(json.dumps({
      "persona_count":300,"cohort_distribution":{"stable":.3,"gradual_shift":.2,"abrupt_task":.2,"exploratory":.15,"noisy":.15},
      "activity_distribution":{"low":.25,"medium":.55,"high":.2},"session_adjustment":{"low":[8,10],"medium":[10,13],"high":[13,15]},
      "exposure_count_bounds":[6,10],"fixed_utc_anchor":"2026-08-17T20:00:00Z","repeat_view_cap_per_item_day":2,
      "event_probabilities":{"view":.55,"material_like":.2,"project_like":.18,"reservation":.025,"save":.12,"follow":.09,"build_started":.035},
      "reversal_probabilities":{"like":.1,"save":.08,"follow":.07},"reservation_outcomes":{"accepted":.18,"completed":.15,"cancelled":.25,"rejected":.16,"expired":.26},
      "build_outcomes":{"completed":.18,"meaningful_progress":.3,"abandoned":.52},"time_decay_half_life_days":14,
      "variants":{"101":{"name":"EXPANDED_FINAL_HOLDOUT","marker":HOLDOUT,"exploration_rate":.15,"loyalty":.5,"action_scale":.9,"project_tendency":.42}}
    }))
    return cfg


def _new_users(categories:list[str]):
    cohorts=["INTERESTS_ONLY","INTERESTS_REINFORCED","PREFERENCE_SHIFT","PROJECT_DRIVEN","NOISY_ACCIDENTAL"]
    rows=[]
    for i in range(50):
        rows.append({"sim_user_key":f"new_user_{i+1:04d}","origin":NEW_ORIGIN,"cohort":cohorts[i//10],
          "primary_interest":categories[(i*3)%len(categories)],"secondary_interest":categories[(i*7+1)%len(categories)],
          "free_preference":round(((i*17)%100)/100,2),"delivery_preference":round(((i*29)%100)/100,2),
          "activity_band":["low","medium","high"][i%3],"project_driven_tendency":.85 if i//10==3 else .25,"benchmark_seed":101})
    return rows


def _staged(users,materials,projects):
    by_category=defaultdict(list)
    for m in materials: by_category[m["category_key"]].append(m)
    events=[]; impressions=[]; base=datetime(2026,8,18,12,tzinfo=timezone.utc)
    for ui,user in enumerate(users):
        recent=user["secondary_interest"] if user["cohort"] in {"PREFERENCE_SHIFT","NOISY_ACCIDENTAL"} else user["primary_interest"]
        pool=sorted(by_category[recent],key=lambda x:x["material_key"])
        if len(pool)<10: pool=sorted(materials,key=lambda x:x["material_key"])
        plan=[("T1_EARLY_BROWSING",pool[:3],["view"]*3),
              ("T2_COHERENT_RECENT_INTENT",pool[3:11],["view"]*6+["like"]*2),
              ("T4_PREFERENCE_DRIFT",pool[11:21],["view"]*8+["like"]*2)]
        if user["cohort"]=="NOISY_ACCIDENTAL":
            mixed=sorted(materials,key=lambda x:hashlib.sha256(f"{user['sim_user_key']}:{x['material_key']}".encode()).hexdigest())[:10]
            plan=[("T1_EARLY_BROWSING",mixed[:3],["view"]*3),("T2_COHERENT_RECENT_INTENT",mixed[3:9],["view"]*5+["like"]),
                  ("T4_PREFERENCE_DRIFT",[mixed[9],mixed[9],mixed[9]],["view","like","unlike"])]
        stage_day={"T1_EARLY_BROWSING":1,"T2_COHERENT_RECENT_INTENT":2,"T4_PREFERENCE_DRIFT":5}
        for stage,chosen,kinds in plan:
            for j,(item,kind) in enumerate(zip(chosen,kinds)):
                ts=base+timedelta(days=stage_day[stage],minutes=ui*2+j); imp=hashlib.sha256(f"b-imp:{user['sim_user_key']}:{stage}:{j}".encode()).hexdigest()
                impressions.append({"impression_key":imp,"sim_user_key":user["sim_user_key"],"entity_key":item["material_key"],"domain":"material","stage":stage,"timestamp_utc":ts.isoformat().replace("+00:00","Z"),"origin":NEW_ORIGIN})
                events.append({"action_key":hashlib.sha256(f"b-action:{imp}:{kind}".encode()).hexdigest(),"impression_key":imp,"sim_user_key":user["sim_user_key"],"entity_key":item["material_key"],"domain":"material","action_type":kind,"stage":stage,"timestamp_utc":(ts+timedelta(seconds=5)).isoformat().replace("+00:00","Z"),"origin":NEW_ORIGIN})
        # One exposure-backed bounded strong signal at T3.
        project=projects[ui%len(projects)]; ts=base+timedelta(days=3,minutes=ui*2); imp=hashlib.sha256(f"b-strong:{user['sim_user_key']}".encode()).hexdigest()
        impressions.append({"impression_key":imp,"sim_user_key":user["sim_user_key"],"entity_key":project["project_key"],"domain":"project","stage":"T3_STRONG_EVIDENCE","timestamp_utc":ts.isoformat().replace("+00:00","Z"),"origin":NEW_ORIGIN})
        events.append({"action_key":hashlib.sha256(f"b-action:{imp}".encode()).hexdigest(),"impression_key":imp,"sim_user_key":user["sim_user_key"],"entity_key":project["project_key"],"domain":"project","action_type":"build_started" if user["cohort"]=="PROJECT_DRIVEN" else "project_save","stage":"T3_STRONG_EVIDENCE","timestamp_utc":(ts+timedelta(seconds=5)).isoformat().replace("+00:00","Z"),"origin":NEW_ORIGIN})
    return impressions,events


def _model(domain,all_personas,items,training_rows,new_keys):
    maps=mappings(all_personas,items,domain); interactions,weights=interaction_matrix(training_rows,maps)
    uf,itf,schema=feature_matrices(all_personas,items,domain,maps,True,new_keys,set(),True)
    cfg=FROZEN[domain]; model=LightFM(loss="warp",no_components=cfg["no_components"],learning_rate=cfg["learning_rate"],user_alpha=cfg["user_alpha"],item_alpha=cfg["item_alpha"],random_state=101)
    started=time.perf_counter(); model.fit(interactions,sample_weight=weights,user_features=uf,item_features=itf,epochs=cfg["epochs"],num_threads=1)
    return model,maps,uf,itf,schema,time.perf_counter()-started,interactions


def run():
    os.environ.setdefault("PYTHONHASHSEED","0"); random.seed(101); np.random.seed(101); a_before=verify_a()
    original=load_snapshot(GENERATED/"catalog-snapshot"); extension=generate_extension(original); extension_audit=audit_extension(extension)
    combined={"materials":[*original["materials"],*extension["materials"]],"projects":[*original["projects"],*extension["projects"]]}
    if len(combined["materials"])!=311 or len(combined["projects"])!=79: raise ValueError("expanded totals")
    # Freeze extension and relationships before simulation or evaluation.
    _write("expanded-catalog/materials.parquet",extension["materials"]); _write("expanded-catalog/projects.parquet",extension["projects"]); _write("expanded-catalog/relations.parquet",extension["relations"])
    training=simulate(combined,_training_config(),101)
    for name,rows in training.items(): _write(f"expanded-training/{name.replace('_','-')}.parquet",rows)
    categories=sorted({r["category_key"] for r in combined["materials"]}); users=_new_users(categories); impressions,actions=_staged(users,combined["materials"],combined["projects"])
    _write("new-users/personas.parquet",users); _write("new-users/impressions.parquet",impressions); _write("new-users/staged-actions.parquet",actions)
    frozen_payload={"extension_hash":extension_audit["logical_hash"],"training_hash":logical_hash(training),"user_hash":hashlib.sha256(json.dumps([users,impressions,actions],sort_keys=True,separators=(",",":")).encode()).hexdigest(),"holdout_seed":101,"marker":HOLDOUT}
    (OUT/"frozen-benchmark.json").write_text(json.dumps(frozen_payload,indent=2,sort_keys=True))
    new_keys={u["sim_user_key"] for u in users}; all_personas=[*training["personas"],*users]
    models={}; performance={}
    for domain in ("material","project"):
        model,maps,uf,itf,schema,fit_s,inter=_model(domain,all_personas,combined[f"{domain}s"],training[f"{domain}_interactions"],new_keys)
        models[domain]=(model,maps,uf,itf); path=OUT/f"models-expanded/{domain}-hybrid.pkl"
        size=save_bundle(path,{"artifact_version":"slice-3-lightfm-v1","model":model,"mappings":maps,"user_features":uf,"item_features":itf,"feature_schema":schema,"benchmark_hashes":frozen_payload,"hyperparameters":FROZEN[domain]})
        test_targets=defaultdict(set); test_ts={}; seen=defaultdict(set)
        for row in training[f"{domain}_interactions"]:
            if row["split"]=="train": seen[row["sim_user_key"]].add(row["entity_key"])
            elif row["split"]=="test":
                test_targets[row["sim_user_key"]].add(row["entity_key"]); test_ts[row["sim_user_key"]]=max(test_ts.get(row["sim_user_key"],""),row["timestamp_utc"])
        universe=CandidateUniverse(combined,training["impressions"]); per=[]
        for user in sorted(test_targets):
            candidates=universe.candidates(user,domain,test_ts[user],seen[user]); ranked=rank_lightfm(model,user,candidates,maps,uf,itf); per.append(metrics(ranked,test_targets[user]))
        standard={name:sum(r[name] for r in per)/max(1,len(per)) for name in ("precision@5","precision@10","recall@5","recall@10","ndcg@5","ndcg@10","mrr","hit_rate@5","hit_rate@10")}
        standard["eligible_users"]=len(per)
        performance[domain]={"fit_seconds":fit_s,"matrix_shape":inter.shape,"nnz":inter.nnz,"user_feature_shape":uf.shape,"item_feature_shape":itf.shape,"model_size_bytes":size,"training_user_test_metrics":standard}
    user_by={u["sim_user_key"]:u for u in users}; all_item={**{x["material_key"]:x for x in combined["materials"]},**{x["project_key"]:x for x in combined["projects"]}}
    action_by=defaultdict(list)
    for row in actions: action_by[row["sim_user_key"]].append(row)
    pop=popularity(training["material_interactions"]); material_by={x["material_key"]:x for x in combined["materials"]}; model,maps,uf,itf=models["material"]
    # Bounded technical update experiment on five new users. Primary casebook
    # continues to use the untouched frozen model.
    update_users={u["sim_user_key"] for u in users[:5]}; update_actions=[a for a in actions if a["sim_user_key"] in update_users and a["domain"]=="material" and a["action_type"] in {"like","view"}]
    rr=[maps["user_index"][a["sim_user_key"]] for a in update_actions]; cc=[maps["item_index"][a["entity_key"]] for a in update_actions]
    update_matrix=sparse.coo_matrix((np.ones(len(rr),dtype=np.float32),(rr,cc)),shape=(len(maps["users"]),len(maps["items"]))).tocsr(); update_matrix.data[:]=1; update_matrix=update_matrix.tocoo()
    updated_models=[]; update_durations=[]
    for _ in range(2):
        updated=copy.deepcopy(model); started=time.perf_counter(); updated.fit_partial(update_matrix,user_features=uf,item_features=itf,epochs=1,num_threads=1); update_durations.append(time.perf_counter()-started); updated_models.append(updated)
    update_rankings=[]
    for updated in updated_models:
        update_rankings.append({u:rank_lightfm(updated,u,maps["items"],maps,uf,itf)[:10] for u in sorted(update_users)})
    if update_rankings[0]!=update_rankings[1]: raise ValueError("bounded update irreproducible")
    updated_model=updated_models[0]; unrelated=training["personas"][0]["sim_user_key"]
    before_unrelated=rank_lightfm(model,unrelated,maps["items"],maps,uf,itf)[:10]; after_unrelated=rank_lightfm(updated_model,unrelated,maps["items"],maps,uf,itf)[:10]
    update_experiment={"status":"BOUNDED_UPDATE_EVALUATED_NOT_ADOPTED","selected_users":5,"epochs":1,"mean_update_seconds":sum(update_durations)/2,
      "reproducible":True,"new_users_representable":True,"identity_features_used_for_new_users":False,
      "mean_selected_top10_change":sum(10-len(set(rank_lightfm(model,u,maps["items"],maps,uf,itf)[:10])&set(update_rankings[0][u])) for u in update_users)/5,
      "unrelated_user_top10_change":10-len(set(before_unrelated)&set(after_unrelated)),"mapping_hash":maps["mapping_hash"],
      "interpretation":"fit_partial is technically valid but updates shared metadata embeddings; it is not adopted as an online serving mechanism."}
    casebook=[]; aggregate=defaultdict(lambda:defaultdict(lambda:defaultdict(list))); stage_order={s:i for i,s in enumerate(STAGES)}
    for user in users:
        previous={}
        for stage in STAGES:
            index=stage_order[stage]; included=[a for a in action_by[user["sim_user_key"]] if stage_order.get(a["stage"],0)<=index]
            if stage=="T0_PROFILE_ONLY": included=[]
            stage_day={"T0_PROFILE_ONLY":0,"T1_EARLY_BROWSING":1,"T2_COHERENT_RECENT_INTENT":2,"T3_STRONG_EVIDENCE":3,"T4_PREFERENCE_DRIFT":5,"T5_DECAY":19}[stage]
            now=(datetime(2026,8,18,20,tzinfo=timezone.utc)+timedelta(days=stage_day)).isoformat().replace("+00:00","Z")
            intent=intent_scores(included,all_item,now)
            interest={k:pop[k]+.25*(v["category_key"] in {user["primary_interest"],user["secondary_interest"]}) for k,v in material_by.items()}
            light_rank=rank_lightfm(model,user["sim_user_key"],maps["items"],maps,uf,itf); light_scores={k:float(len(light_rank)-i) for i,k in enumerate(light_rank)}
            ranks={"interest_baseline":sorted(material_by,key=lambda k:(-interest[k],k)),"frozen_hybrid":light_rank,
                   "short_term_only":rerank({k:0 for k in material_by},material_by,intent,1.0),"hybrid_plus_short_term":rerank(light_scores,material_by,intent,.35)}
            if user["sim_user_key"] in update_users:
                ranks["bounded_updated_lightfm"]=rank_lightfm(updated_model,user["sim_user_key"],maps["items"],maps,uf,itf)
            target=user["secondary_interest"] if user["cohort"]=="PREFERENCE_SHIFT" and index>=2 else user["primary_interest"]
            row={"synthetic_user_key":user["sim_user_key"],"cohort":user["cohort"],"stage":stage,"explicit_interests":[user["primary_interest"],user["secondary_interest"]],"staged_actions":[{"type":a["action_type"],"domain":a["domain"]} for a in included],"models":{},"origin":NEW_ORIGIN}
            for name,rank in ranks.items():
                top=rank[:10]; cats=[material_by[x]["category_label"] for x in top]; match=sum(material_by[x]["category_key"]==target for x in top[:5])/5
                overlap=len(set(top)&set(previous.get(name,[])))/10 if name in previous else None
                recent_category=user["secondary_interest"] if user["cohort"]=="PREFERENCE_SHIFT" else user["primary_interest"]
                active_projects=[all_item[a["entity_key"]] for a in included if a["domain"]=="project"]
                required={c for p in active_projects for c in p.get("component_concept_keys",[])}
                component_match=lambda x: bool(required & set(material_by[x].get("component_concept_keys",[])))
                row["models"][name]={"top5":[{"synthetic_review_name":material_by[x].get("synthetic_review_name",material_by[x]["category_label"]),"category_label":material_by[x]["category_label"],"concept_labels":material_by[x]["concept_labels"]} for x in top[:5]],"top10_category_distribution":dict(Counter(cats)),"top10_concept_distribution":dict(Counter(label for x in top for label in material_by[x]["concept_labels"])),"diversity":len(set(cats))/10,"overlap_previous_top10":overlap,"target_match_top5":match,
                  "explicit_interest_match_top5":sum(material_by[x]["category_key"]==user["primary_interest"] for x in top[:5])/5,
                  "recent_intent_match_top5":sum(material_by[x]["category_key"]==recent_category for x in top[:5])/5,
                  "project_component_relevance_top5":sum(component_match(x) for x in top[:5])/5 if required else None,
                  "unrelated_rate_top10":sum(material_by[x]["category_key"] not in {user["primary_interest"],recent_category} and not component_match(x) for x in top)/10,
                  "changed_items":len(set(top)-set(previous.get(name,[]))) if name in previous else 0}
                aggregate[user["cohort"]][stage][name].append(match); previous[name]=top
            casebook.append(row)
    (OUT/"new-users/recommendation-casebook.json").write_text(json.dumps(casebook,indent=2,sort_keys=True))
    exposure_counts=Counter(r["entity_key"] for r in training["impressions"]); engaged=defaultdict(set)
    for r in training["material_interactions"]+training["project_interactions"]: engaged[r["entity_key"]].add(r["sim_user_key"])
    expanded_keys={r["material_key"] for r in extension["materials"]}|{r["project_key"] for r in extension["projects"]}
    coverage={f"impressions_at_least_{n}":sum(exposure_counts[k]>=n for k in expanded_keys)/len(expanded_keys) for n in (1,5,10)}
    coverage.update({f"engaged_users_at_least_{n}":sum(len(engaged[k])>=n for k in expanded_keys)/len(expanded_keys) for n in (2,3,5)})
    cohort_stage={c:{s:{model:sum(values)/len(values) for model,values in models.items()} for s,models in stages.items()} for c,stages in aggregate.items()}
    def case_mean(cohort,stage,field):
        values=[r["models"]["hybrid_plus_short_term"][field] for r in casebook if r["cohort"]==cohort and r["stage"]==stage]
        return sum(values)/len(values)
    acceptance={"profile_only_explicit_match":sum(r["models"]["frozen_hybrid"]["explicit_interest_match_top5"] for r in casebook if r["stage"]=="T0_PROFILE_ONLY")/50,
      "shift_recent_match_t4":case_mean("PREFERENCE_SHIFT","T4_PREFERENCE_DRIFT","recent_intent_match_top5"),
      "shift_long_term_retained_t4":case_mean("PREFERENCE_SHIFT","T4_PREFERENCE_DRIFT","explicit_interest_match_top5"),
      "shift_recent_match_t5":case_mean("PREFERENCE_SHIFT","T5_DECAY","recent_intent_match_top5"),
      "shift_long_term_match_t5":case_mean("PREFERENCE_SHIFT","T5_DECAY","explicit_interest_match_top5"),
      "noise_unrelated_t4":case_mean("NOISY_ACCIDENTAL","T4_PREFERENCE_DRIFT","unrelated_rate_top10"),
      "decay_gradual_pass":case_mean("PREFERENCE_SHIFT","T5_DECAY","recent_intent_match_top5") < case_mean("PREFERENCE_SHIFT","T4_PREFERENCE_DRIFT","recent_intent_match_top5")}
    automatic="ELIGIBLE_FOR_MANUAL_NEW_USER_REVIEW" if acceptance["decay_gradual_pass"] else "NEW_USER_PERSONALIZATION_NOT_COMPETITIVE"
    summary={"automatic_result":automatic,"benchmark_a_hashes":a_before,"benchmark_b_frozen":frozen_payload,"extension_audit":extension_audit,"expanded_totals":{"materials":311,"projects":79},"training_personas":300,"new_users":50,"new_users_in_training":0,"exposure_coverage":coverage,"cohort_stage_target_match":cohort_stage,"acceptance_scenarios":acceptance,"performance":performance,"frozen_hyperparameters":FROZEN,"blend":.35,"casebook_rows":len(casebook),"update_experiment":update_experiment,"holdout":{"seed":101,"marker":HOLDOUT,"used_for_selection":False}}
    (OUT/"expanded-metrics.json").write_text(json.dumps(summary,indent=2,sort_keys=True,default=list)); (OUT/"expanded-holdout-results.json").write_text(json.dumps({"frozen_hashes":frozen_payload,"result":summary["automatic_result"]},indent=2,sort_keys=True))
    if verify_a()!=a_before: raise ValueError("Benchmark A mutated")
    return summary


def main():
    value=run(); print(value["automatic_result"]); return 0


if __name__=="__main__": raise SystemExit(main())
