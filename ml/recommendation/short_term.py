"""Bounded, explainable, deterministic offline recent-intent channel."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

STRENGTH={"view":.35,"like":1.0,"project_save":1.8,"project_follow":1.8,"build_started":2.5,"reservation":2.5}


def intent_scores(actions:list[dict[str,Any]],item_by:dict[str,dict[str,Any]],now:str,half_life_days:float=4.0):
    active_like={}; view_count=defaultdict(int); scores=defaultdict(float)
    cutoff=datetime.fromisoformat(now.replace("Z","+00:00"))
    for action in sorted(actions,key=lambda x:x["timestamp_utc"]):
        kind=action["action_type"]; item=action["entity_key"]
        if kind=="unlike": active_like[item]=False; continue
        if kind=="like": active_like[item]=True; continue
        if kind=="view":
            view_count[item]+=1
            if view_count[item]>2: continue
        strength=STRENGTH.get(kind,0.0)
        age=max(0,(cutoff-datetime.fromisoformat(action["timestamp_utc"].replace("Z","+00:00"))).total_seconds()/86400)
        weight=strength*(.5**(age/half_life_days))
        row=item_by[item]
        scores[f"category:{row['category_key']}"]+=weight
        for concept in row.get("concept_keys",[]): scores[f"concept:{concept}"]+=weight
        for concept in row.get("component_concept_keys",[]): scores[f"component:{concept}"]+=weight
    for item,active in active_like.items():
        if not active: continue
        row=item_by[item]; scores[f"category:{row['category_key']}"]+=STRENGTH["like"]
        for concept in row.get("concept_keys",[]): scores[f"concept:{concept}"]+=STRENGTH["like"]
    # Saturation prevents one category or accidental action from becoming unbounded.
    return {key:min(4.0,value) for key,value in scores.items()}


def score_item(item:dict[str,Any],intent:dict[str,float])->float:
    values=[intent.get(f"category:{item['category_key']}",0.0)]
    values += [intent.get(f"concept:{x}",0.0) for x in item.get("concept_keys",[])]
    values += [intent.get(f"component:{x}",0.0) for x in item.get("component_concept_keys",[])]
    return min(1.0,sum(values)/(4.0*max(1,len(values))))


def rerank(base_scores:dict[str,float],items:dict[str,dict[str,Any]],intent:dict[str,float],blend:float=.35):
    values=list(base_scores.values()); lo=min(values,default=0); hi=max(values,default=1)
    normalized={k:(v-lo)/(hi-lo) if hi>lo else 0.0 for k,v in base_scores.items()}
    return sorted(items,key=lambda k:(-((1-blend)*normalized.get(k,0)+blend*score_item(items[k],intent)),k))


def recent_confidence(actions:list[dict[str,Any]],item_by:dict[str,dict[str,Any]],now:str)->dict[str,Any]:
    """Exact offline peer of the runtime burst-aware NONE/LOW/MEDIUM/HIGH gate."""
    cutoff=datetime.fromisoformat(now.replace("Z","+00:00"))

    def projection(max_age_days:float):
        views=defaultdict(int); likes={}; strong=set(); timestamps=[]
        for action in sorted(actions,key=lambda x:x["timestamp_utc"]):
            timestamp=datetime.fromisoformat(action["timestamp_utc"].replace("Z","+00:00")); age=(cutoff-timestamp).total_seconds()/86400
            if age<0 or age>max_age_days or action["entity_key"] not in item_by: continue
            kind=action["action_type"]; key=action["entity_key"]
            if kind=="view": views[key]=min(2,views[key]+1)
            elif kind=="like": likes[key]=True
            elif kind=="unlike": likes[key]=False
            elif kind in {"reservation","build_started"}: strong.add(key)
            else: continue
            timestamps.append(timestamp)
        entities=set(views)|{key for key,active in likes.items() if active}|strong
        category_votes=defaultdict(float); concept_votes=defaultdict(float); total=0.0
        for key in entities:
            contribution=(STRENGTH["view"] if key in views else 0)+(STRENGTH["like"] if likes.get(key) else 0)+(STRENGTH["reservation"] if key in strong else 0)
            total+=contribution; row=item_by[key]; category_votes[row["category_key"]]+=contribution
            for concept in set(row.get("concept_keys",[])): concept_votes[concept]+=contribution
        candidates=[*( (f"category:{key}",value) for key,value in category_votes.items()),*( (f"concept:{key}",value) for key,value in concept_votes.items())]
        dominant=sorted(candidates,key=lambda x:(-x[1],x[0]))[0] if candidates else (None,0.0)
        share=lambda votes:max(votes.values(),default=0.0)/total if total else 0.0
        newest=(cutoff-max(timestamps)).total_seconds()/86400 if timestamps else None
        return {"views":views,"likes":likes,"strong":strong,"entities":entities,"category_share":share(category_votes),"concept_share":share(concept_votes),"dominant_share":dominant[1]/total if total else 0.0,"dominant_feature":dominant[0],"newest_age":newest}

    history=projection(14); burst=projection(1); feature=burst["dominant_feature"]
    def matches(key:str)->bool:
        if not feature: return False
        row=item_by[key]
        return feature==f"category:{row['category_key']}" if feature.startswith("category:") else feature in {f"concept:{value}" for value in row.get("concept_keys",[])}
    coherent_views=sum(matches(key) for key in burst["views"]); coherent_likes=sum(active and matches(key) for key,active in burst["likes"].items()); coherent_strong=sum(matches(key) for key in burst["strong"])
    age_factor=.5**(burst["newest_age"]/4) if burst["newest_age"] is not None else 0; confidence="LOW" if history["entities"] else "NONE"; source="INSUFFICIENT_COHERENCE" if history["entities"] else "NONE"
    if burst["dominant_share"]>=.6 and age_factor>=.25 and coherent_views>=4: confidence,source="MEDIUM","VIEW_BURST"
    if burst["dominant_share"]>=.6 and age_factor>=.25 and coherent_likes>=1 and coherent_views>=3: confidence,source="MEDIUM","LIKE_SUPPORTED_BURST"
    if burst["dominant_share"]>=.7 and age_factor>=.5 and coherent_views>=8 and coherent_likes>=2: confidence,source="HIGH","VIEW_BURST"
    if burst["dominant_share"]>=.7 and age_factor>=.5 and coherent_likes>=5: confidence,source="HIGH","MULTI_LIKE_BURST"
    if burst["dominant_share"]>=.7 and age_factor>=.5 and coherent_strong>=1 and coherent_views>=3: confidence,source="HIGH","STRONG_ACTION_BURST"
    return {"confidence":confidence,"confidence_source":source,"burst_window_hours":24,"unique_recent_material_count":len(history["entities"]),"unique_recent_view_count":len(history["views"]),"active_recent_like_count":sum(history["likes"].values()),"strong_action_count":len(history["strong"]),"burst_unique_material_count":len(burst["entities"]),"burst_unique_view_count":len(burst["views"]),"burst_active_like_count":sum(burst["likes"].values()),"burst_strong_action_count":len(burst["strong"]),"burst_dominant_category_share":burst["category_share"],"burst_dominant_concept_share":burst["concept_share"],"full_history_dominant_category_share":history["category_share"],"full_history_dominant_concept_share":history["concept_share"],"dominant_evidence_share":burst["dominant_share"],"newest_evidence_age_days":burst["newest_age"]}


def fuse_ranks(long_term:list[str],items:dict[str,dict[str,Any]],intent:dict[str,float],confidence:str)->list[str]:
    """Deterministic rank fusion; raw LightFM and recent scores are never compared."""
    if len(set(long_term))!=len(long_term): raise ValueError("duplicate_candidate")
    recent=sorted(((key,score_item(items[key],intent)) for key in long_term),key=lambda x:(-x[1],x[0]))
    recent=[key for key,score in recent if score>=.05][:30]; top5=2 if confidence=="HIGH" else 1 if confidence=="MEDIUM" else 0; top10=3 if confidence=="HIGH" else 1 if confidence=="MEDIUM" else 0
    if not top10 or not recent: return list(long_term)
    selected5=recent[:top5]; selected10=recent[top5:top10]; reserved=set(selected5+selected10); remaining=[key for key in long_term if key not in reserved]; fused=[]
    def take():
        if remaining: fused.append(remaining.pop(0))
    take()
    if selected5: fused.append(selected5[0])
    take()
    if len(selected5)>1: fused.append(selected5[1])
    while len(fused)<5: take()
    fused.extend(selected10)
    while len(fused)<10: take()
    return fused+remaining
