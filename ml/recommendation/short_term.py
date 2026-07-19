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
    """Exact offline peer of the runtime NONE/LOW/MEDIUM/HIGH gate."""
    cutoff=datetime.fromisoformat(now.replace("Z","+00:00")); views=defaultdict(int); likes={}; strong=set(); timestamps=[]
    for action in sorted(actions,key=lambda x:x["timestamp_utc"]):
        timestamp=datetime.fromisoformat(action["timestamp_utc"].replace("Z","+00:00")); age=(cutoff-timestamp).total_seconds()/86400
        if age<0 or age>14 or action["entity_key"] not in item_by: continue
        kind=action["action_type"]; key=action["entity_key"]
        if kind=="view": views[key]=min(2,views[key]+1)
        elif kind=="like": likes[key]=True
        elif kind=="unlike": likes[key]=False
        elif kind in {"reservation","build_started"}: strong.add(key)
        else: continue
        timestamps.append(timestamp)
    entities=set(views)|{k for k,v in likes.items() if v}|strong; votes=defaultdict(int)
    for key in entities:
        row=item_by[key]
        for feature in {f"category:{row['category_key']}",*(f"concept:{x}" for x in row.get("concept_keys",[]))}: votes[feature]+=1
    dominant=sorted(votes.items(),key=lambda x:(-x[1],x[0]))[0] if votes else (None,0)
    coherence=dominant[1]/len(entities) if entities else 0; newest_age=(cutoff-max(timestamps)).total_seconds()/86400 if timestamps else None
    age_factor=.5**(newest_age/4) if newest_age is not None else 0; active_likes=sum(likes.values()); confidence="NONE" if not entities else "LOW"
    if coherence>=.6 and (len(views)>=4 or (active_likes>=1 and len(views)>=3)) and age_factor>=.25: confidence="MEDIUM"
    if coherence>=.7 and ((len(views)>=8 and active_likes>=2) or (len(strong)>=1 and len(views)>=3)) and age_factor>=.5: confidence="HIGH"
    return {"confidence":confidence,"unique_recent_material_count":len(views),"active_recent_like_count":active_likes,"strong_action_count":len(strong),"dominant_evidence_share":coherence,"newest_evidence_age_days":newest_age}


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
