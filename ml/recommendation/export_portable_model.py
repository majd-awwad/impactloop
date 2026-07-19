"""Export accepted Benchmark A hybrid metadata embeddings for Node shadow scoring."""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import lightfm

from .catalog_snapshot import load_snapshot
from .features import RUNTIME_FEATURE_SCHEMA_VERSION, feature_matrices, interaction_matrix
from .model_io import load_bundle
from .short_term import intent_scores, rerank, score_item
from .train_lightfm import _evaluate, _fit, _prepare

ROOT=Path(__file__).resolve().parents[2]; GENERATED=ROOT/"ml/recommendation/generated"; OUT=GENERATED/"portable-model"
ARTIFACT_VERSION="impactloop-lightfm-portable-v1"; MODEL_VERSION="slice-4a-shadow-v1"
RUNTIME_MODEL_VERSION="slice-4c-runtime-v2"
FROZEN={"material":{"no_components":16,"epochs":10,"learning_rate":.03,"user_alpha":1e-6,"item_alpha":1e-6},"project":{"no_components":32,"epochs":10,"learning_rate":.03,"user_alpha":1e-6,"item_alpha":1e-6}}


def canonical(value:Any)->str:
    def normalize(item):
        if isinstance(item,float) and item.is_integer(): return int(item)
        if isinstance(item,list): return [normalize(x) for x in item]
        if isinstance(item,dict): return {k:normalize(v) for k,v in item.items()}
        return item
    return json.dumps(normalize(value),sort_keys=True,separators=(",",":"),ensure_ascii=False)


def _entries(names,embeddings,biases,prefix):
    rows=[]
    for index,name in enumerate(names):
        if name.startswith(prefix): continue
        if any(bad in name for bad in ("material_type","hidden","cohort","SYNTHETIC_CATALOG_EXTENSION")): raise ValueError(f"prohibited feature: {name}")
        rows.append({"name":name,"embedding":[format(float(x),".17g") for x in embeddings[index]],"bias":format(float(biases[index]),".17g")})
    return rows


def export_domain(seed:int,domain:str)->dict[str,Any]:
    source=load_bundle(GENERATED/f"models/seed-{seed}/{domain}-hybrid.pkl")
    model=source["model"]; schema=source["feature_schema"]
    artifact={"artifact_version":ARTIFACT_VERSION,"model_version":MODEL_VERSION,"domain":domain,"feature_schema_version":source["feature_schema_version"],
      "latent_dimension":int(model.no_components),"catalog_snapshot_hash":source["snapshot_hash"],"training_dataset_hash":source["simulator_hash"],"mapping_hash":source["mapping_hash"],
      "hyperparameters":{key:format(float(value),".17g") for key,value in source["hyperparameters"].items()},"python_version":platform.python_version(),"lightfm_version":lightfm.__version__,"exported_at_utc":datetime.now(timezone.utc).isoformat(),
      "user_features":_entries(schema["user_features"],model.user_embeddings,model.user_biases,"user_identity:"),
      "item_features":_entries(schema["item_features"],model.item_embeddings,model.item_biases,"item_identity:")}
    artifact["content_hash"]=hashlib.sha256(canonical(artifact).encode()).hexdigest()
    return artifact


def train_runtime_domain(seed:int,domain:str,catalog:dict[str,Any]):
    prepared=_prepare(seed,domain,catalog);data,items,_,mask,maps=prepared
    interactions,weights=interaction_matrix(mask["training_view"],maps)
    uf,itf,schema=feature_matrices(data["personas"],items,domain,maps,True,metadata=True,runtime_contract=True)
    model,fit_seconds=_fit(seed,FROZEN[domain],interactions,weights,uf,itf)
    metrics,_,_=_evaluate(model,"hybrid","test",prepared,catalog,(uf,itf))
    artifact={"artifact_version":ARTIFACT_VERSION,"model_version":RUNTIME_MODEL_VERSION,"domain":domain,"feature_schema_version":RUNTIME_FEATURE_SCHEMA_VERSION,
      "latent_dimension":int(model.no_components),"catalog_snapshot_hash":catalog["summary"]["content_hash"],"training_dataset_hash":"99523dc1037e076b7472358581d7388cec3eb68b777555f8000e6d79879f4eb4","mapping_hash":maps["mapping_hash"],
      "hyperparameters":{key:format(float(value),".17g") for key,value in FROZEN[domain].items()},"python_version":platform.python_version(),"lightfm_version":lightfm.__version__,"exported_at_utc":"2026-07-19T00:00:00+00:00",
      "user_features":_entries(schema["user_features"],model.user_embeddings,model.user_biases,"user_identity:"),"item_features":_entries(schema["item_features"],model.item_embeddings,model.item_biases,"item_identity:")}
    artifact["content_hash"]=hashlib.sha256(canonical(artifact).encode()).hexdigest()
    return artifact,{"ndcg@10":metrics["ndcg@10"],"recall@10":metrics["recall@10"],"fit_seconds":fit_seconds,"user_feature_count":len(artifact["user_features"]),"item_feature_count":len(artifact["item_features"])}


def score(artifact,features,side):
    entries={x["name"]:x for x in artifact[f"{side}_features"]}; dim=artifact["latent_dimension"]; vector=[0.0]*dim; bias=0.0
    for name,weight in features:
        entry=entries.get(name)
        if not entry: continue
        bias+=float(entry["bias"])*weight
        for i,value in enumerate(entry["embedding"]): vector[i]+=float(value)*weight
    return vector,bias


def fixtures(material,project):
    catalog=load_snapshot(GENERATED/"catalog-snapshot"); cases=[]
    for artifact,domain in ((material,"material"),(project,"project")):
        items=catalog[f"{domain}s"][:12]; category=items[0]["category_key"]
        user=[(f"interest:{category}",1.0),("activity:medium",1.0),("free_pref:2",1.0),("delivery_pref:2",1.0),("project_tendency:1",1.0)]
        uv,ub=score(artifact,user,"user"); candidates=[]
        for item in items:
            tokens=[(f"category:{item['category_key']}",1.0),*[(f"concept:{x}",1.0) for x in item["concept_keys"]]]
            if domain=="material": tokens += [(f"condition:{item['condition']}",1.0),(f"free:{int(item['is_free'])}",1.0),(f"pickup:{int(item['pickup_allowed'])}",1.0),(f"delivery:{int(item['delivery_allowed'])}",1.0)]
            else: tokens += [(f"difficulty:{item['difficulty']}",1.0),*[(f"component:{x}",1.0) for x in item["component_concept_keys"]]]
            iv,ib=score(artifact,tokens,"item"); value=sum(a*b for a,b in zip(uv,iv))+ub+ib
            candidates.append({"candidate_key":item[f"{domain}_key"],"features":tokens,"python_score":value})
        ranked=sorted(candidates,key=lambda x:(-x["python_score"],x["candidate_key"]))
        cases.append({"name":f"{domain}-profile-only-cold","domain":domain,"user_features":user,"candidates":candidates,"python_top5":[x["candidate_key"] for x in ranked[:5]],"python_top10":[x["candidate_key"] for x in ranked[:10]]})
    metadata={"a":{"category_key":"cat-a","concept_keys":["concept-a"],"component_concept_keys":[]},"b":{"category_key":"cat-b","concept_keys":["concept-b"],"component_concept_keys":["component-x"]},"p":{"category_key":"cat-p","concept_keys":[],"component_concept_keys":["component-x"]}}
    base={"a":.2,"b":.8}; timestamp="2026-08-10T00:00:00Z"
    raw={
      "profile-only":[],
      "aligned-likes":[("a","like","2026-08-09T00:00:00Z")],
      "preference-shift":[("b","view","2026-08-09T00:00:00Z"),("b","like","2026-08-09T01:00:00Z")],
      "project-driven":[("p","build_started","2026-08-09T00:00:00Z")],
      "accidental-like":[("b","like","2026-08-09T00:00:00Z")],
      "like-unlike":[("b","like","2026-08-09T00:00:00Z"),("b","unlike","2026-08-09T01:00:00Z")],
      "repeated-views":[("b","view","2026-08-09T00:00:00Z"),("b","view","2026-08-09T01:00:00Z"),("b","view","2026-08-09T02:00:00Z")],
      "decay":[("b","view","2026-07-20T00:00:00Z")],
    }
    intent_cases=[]
    for name,values in raw.items():
        events=[{"entity_key":entity,"action_type":kind,"timestamp_utc":when} for entity,kind,when in values]
        intent=intent_scores(events,metadata,timestamp)
        recent={key:score_item(value,intent) for key,value in metadata.items() if key in base}
        ranked=rerank(base,{key:metadata[key] for key in base},intent,.35)
        intent_cases.append({"name":name,"evaluation_timestamp":timestamp,"events":events,"metadata":metadata,"base_scores":base,"python_recent_scores":recent,"python_combined_top":ranked})
    return {"lightfm_cases":cases,"intent_cases":intent_cases}


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--seed",type=int,default=11,choices=[11]);parser.add_argument("--runtime-v2",action="store_true");args=parser.parse_args();OUT.mkdir(parents=True,exist_ok=True)
    if args.runtime_v2:
        catalog=load_snapshot(GENERATED/"catalog-snapshot");results={}
        for domain in ("material","project"):
            artifact,metrics=train_runtime_domain(args.seed,domain,catalog);(OUT/f"{domain}-hybrid-runtime-v2.json").write_text(json.dumps(artifact,indent=2,sort_keys=True));results[domain]={"content_hash":artifact["content_hash"],**metrics}
        (OUT/"runtime-v2-comparison.json").write_text(json.dumps(results,indent=2,sort_keys=True));print(json.dumps({"status":"PASS","runtime_v2":results}));return 0
    material=export_domain(args.seed,"material");project=export_domain(args.seed,"project")
    (OUT/"material-hybrid.json").write_text(json.dumps(material,indent=2,sort_keys=True));(OUT/"project-hybrid.json").write_text(json.dumps(project,indent=2,sort_keys=True))
    parity=fixtures(material,project);(OUT/"parity-fixtures.json").write_text(json.dumps(parity,indent=2,sort_keys=True))
    print(json.dumps({"status":"PASS","material_hash":material["content_hash"],"project_hash":project["content_hash"],"fixtures":len(parity["lightfm_cases"])+len(parity["intent_cases"])}));return 0


if __name__=="__main__":raise SystemExit(main())
