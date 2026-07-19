"""Frozen deterministic Benchmark B synthetic catalog extension."""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from itertools import combinations
from typing import Any

ORIGIN = "SYNTHETIC_CATALOG_EXTENSION"
RELATION_LABELS = {"EXACT_COMPONENT_MATCH", "VALID_ALTERNATIVE", "WEAKLY_RELATED", "UNRELATED"}


def _key(kind: str, index: int) -> str:
    return hashlib.sha256(f"impactloop-benchmark-b-{kind}:{index:04d}".encode()).hexdigest()


def generate_extension(original: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    categories = sorted({(r["category_key"], r["category_label"]) for r in original["materials"]})
    concepts = sorted({k for r in original["materials"] for k in r["concept_keys"]})
    conditions = ["NEW", "LIKE_NEW", "GOOD", "FAIR"]
    states = [(True, "FREE"), (False, "LOW"), (False, "MEDIUM"), (False, "HIGH")]
    delivery = [(True, False), (True, True), (False, True)]
    materials=[]; signatures=set(); cursor=0
    # Deterministic rejection sampling creates non-uniform but unique structured vectors.
    while len(materials) < 150:
        i=cursor; cursor+=1
        category_key, category_label = categories[(i * 7 + i // 11) % len(categories)]
        concept_set=tuple(sorted({concepts[(i*5)%len(concepts)],concepts[(i*11+3)%len(concepts)]}))
        condition=conditions[(i*3+i//9)%len(conditions)]; is_free,price=states[(i+i//5)%len(states)]
        pickup,deliver=delivery[(i*2+i//7)%len(delivery)]
        components=tuple(sorted({f"component:benchmark-b-{(i*3)%24:02d}",f"component:benchmark-b-{(i*7+1)%24:02d}"}))
        signature=(category_key,concept_set,condition,is_free,pickup,deliver,components)
        if signature in signatures: continue
        signatures.add(signature); n=len(materials)+1
        materials.append({
            "material_key":_key("material",n),"category_key":category_key,"category_label":category_label,
            "material_type":"excluded-synthetic-review-only","material_type_label":f"Synthetic Structured Material {n:03d}",
            "concept_keys":list(concept_set),"concept_labels":[f"Synthetic controlled concept {concepts.index(x):02d}" for x in concept_set],
            "component_concept_keys":list(components),"condition":condition,"is_free":is_free,"price_bucket":price,
            "pickup_allowed":pickup,"delivery_allowed":deliver,"public_state":"AVAILABLE",
            "publication_timestamp":"2026-07-15T00:00:00Z","origin":ORIGIN,
            "synthetic_review_name":f"Synthetic {category_label} Material {n:03d}",
        })
    project_categories=sorted({(r["category_key"],r["category_label"]) for r in original["projects"]})
    component_structures=list(combinations(range(24),3))
    projects=[]; structures=set()
    for i in range(50):
        category_key,category_label=project_categories[(i*5+i//6)%len(project_categories)]
        required=tuple(f"component:benchmark-b-{value:02d}" for value in component_structures[(i*37)%len(component_structures)])
        if required in structures: raise AssertionError("duplicate component structure")
        structures.add(required); n=i+1
        projects.append({
            "project_key":_key("project",n),"category_key":category_key,"category_label":category_label,
            "concept_keys":[f"project-topic:benchmark-b-{i%10:02d}"],"concept_labels":[f"Synthetic {category_label} Topic {i%10:02d}"],
            "difficulty":["BEGINNER","INTERMEDIATE","ADVANCED"][i%3],"component_concept_keys":list(required),
            "component_concept_labels":[f"Synthetic Component {x.rsplit('-',1)[-1]}" for x in required],
            "public_state":"PUBLISHED","publication_timestamp":"2026-07-15T00:00:00Z","origin":ORIGIN,
            "synthetic_review_name":f"Synthetic {category_label} Learning Project {n:02d}",
        })
    relations=[]
    for p_index,project in enumerate(projects):
        ranked=sorted(materials,key=lambda m:hashlib.sha256(f"{project['project_key']}:{m['material_key']}".encode()).hexdigest())
        for label,count,offset in (("EXACT_COMPONENT_MATCH",3,0),("VALID_ALTERNATIVE",2,3),("WEAKLY_RELATED",1,5)):
            for material in ranked[offset:offset+count]:
                relations.append({"project_key":project["project_key"],"material_key":material["material_key"],"relation":label,"origin":ORIGIN})
    return {"materials":materials,"projects":projects,"relations":relations}


def audit_extension(value: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    materials,projects,relations=value["materials"],value["projects"],value["relations"]
    signatures=[(m["category_key"],tuple(m["concept_keys"]),m["condition"],m["is_free"],m["pickup_allowed"],m["delivery_allowed"],tuple(m["component_concept_keys"])) for m in materials]
    near_duplicates=sum(sum(a!=b for a,b in zip(left,right))<=1 for i,left in enumerate(signatures) for right in signatures[i+1:])
    by_project=Counter(r["project_key"] for r in relations if r["relation"]=="EXACT_COMPONENT_MATCH")
    alternatives=Counter(r["project_key"] for r in relations if r["relation"]=="VALID_ALTERNATIVE")
    concentration=Counter(r["material_key"] for r in relations)
    return {"material_count":len(materials),"project_count":len(projects),"exact_duplicate_vectors":len(signatures)-len(set(signatures)),"near_duplicate_vectors":near_duplicates,
            "duplicate_component_structures":len(projects)-len({tuple(p["component_concept_keys"]) for p in projects}),
            "projects_without_exact":sum(by_project[p["project_key"]]==0 for p in projects),"projects_without_alternatives":sum(alternatives[p["project_key"]]==0 for p in projects),
            "maximum_project_links_per_material":max(concentration.values(),default=0),"relation_distribution":dict(Counter(r["relation"] for r in relations)),
            "logical_hash":hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":")).encode()).hexdigest()}
