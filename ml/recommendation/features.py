"""Approved, deterministic LightFM feature and interaction matrices."""
from __future__ import annotations

import hashlib
from typing import Any

import numpy as np
from scipy import sparse

FEATURE_SCHEMA_VERSION = "slice-3-approved-features-v1"
RUNTIME_FEATURE_SCHEMA_VERSION = "runtime-approved-features-v2"


def mappings(personas: list[dict[str, Any]], items: list[dict[str, Any]], domain: str) -> dict[str, Any]:
    key = f"{domain}_key"
    users = sorted(p["sim_user_key"] for p in personas)
    item_keys = sorted(row[key] for row in items)
    result = {"users": users, "items": item_keys,
              "user_index": {v: i for i, v in enumerate(users)},
              "item_index": {v: i for i, v in enumerate(item_keys)}}
    result["mapping_hash"] = hashlib.sha256(("\n".join(users) + "\n--\n" + "\n".join(item_keys)).encode()).hexdigest()
    return result


def approved_user_tokens(persona: dict[str, Any]) -> list[tuple[str, float]]:
    tokens = [(f"interest:{persona['primary_interest']}", 1.0),
              (f"activity:{persona['activity_band']}", 1.0),
              (f"free_pref:{min(3, int(persona['free_preference'] * 4))}", 1.0),
              (f"delivery_pref:{min(3, int(persona['delivery_preference'] * 4))}", 1.0),
              (f"project_tendency:{min(3, int(persona['project_driven_tendency'] * 4))}", 1.0)]
    if persona.get("secondary_interest"):
        tokens.append((f"interest:{persona['secondary_interest']}", .5))
    return tokens


def runtime_user_tokens(persona: dict[str, Any]) -> list[tuple[str, float]]:
    values = [persona["primary_interest"]]
    if persona.get("secondary_interest"):
        values.append(persona["secondary_interest"])
    return [(f"interest:{value}", 1.0) for value in sorted(set(values))]


def approved_item_tokens(item: dict[str, Any], domain: str) -> list[tuple[str, float]]:
    tokens = [(f"category:{item['category_key']}", 1.0)]
    tokens += [(f"concept:{value}", 1.0) for value in item["concept_keys"]]
    if domain == "material":
        tokens += [(f"condition:{item['condition']}", 1.0), (f"free:{int(item['is_free'])}", 1.0),
                   (f"pickup:{int(item['pickup_allowed'])}", 1.0), (f"delivery:{int(item['delivery_allowed'])}", 1.0)]
    else:
        tokens += [(f"difficulty:{item['difficulty']}", 1.0)]
        tokens += [(f"component:{value}", 1.0) for value in item["component_concept_keys"]]
    return tokens


def feature_matrices(personas: list[dict[str, Any]], items: list[dict[str, Any]], domain: str,
                     maps: dict[str, Any], identities: bool,
                     cold_users: set[str] | None = None, cold_items: set[str] | None = None,
                     metadata: bool = True, runtime_contract: bool = False):
    cold_users, cold_items = cold_users or set(), cold_items or set()
    persona_by = {p["sim_user_key"]: p for p in personas}; key = f"{domain}_key"; item_by = {r[key]: r for r in items}
    user_tokens = runtime_user_tokens if runtime_contract else approved_user_tokens
    user_meta = sorted({t for p in personas for t, _ in user_tokens(p)}) if metadata else []
    item_meta = sorted({t for item in items for t, _ in approved_item_tokens(item, domain)}) if metadata else []
    user_names = ([f"user_identity:{u}" for u in maps["users"]] if identities else []) + user_meta
    item_names = ([f"item_identity:{i}" for i in maps["items"]] if identities else []) + item_meta
    ui, ii = {v: i for i, v in enumerate(user_names)}, {v: i for i, v in enumerate(item_names)}
    ur: list[int] = []; uc: list[int] = []; uv: list[float] = []
    for row, user in enumerate(maps["users"]):
        values = user_tokens(persona_by[user]) if metadata else []
        if identities and user not in cold_users: values = [(f"user_identity:{user}", 1.0), *values]
        for token, value in values: ur.append(row); uc.append(ui[token]); uv.append(value)
    ir: list[int] = []; ic: list[int] = []; iv: list[float] = []
    for row, item in enumerate(maps["items"]):
        values = approved_item_tokens(item_by[item], domain) if metadata else []
        if identities and item not in cold_items: values = [(f"item_identity:{item}", 1.0), *values]
        for token, value in values: ir.append(row); ic.append(ii[token]); iv.append(value)
    user_matrix = sparse.csr_matrix((uv, (ur, uc)), shape=(len(maps["users"]), len(user_names)), dtype=np.float32)
    item_matrix = sparse.csr_matrix((iv, (ir, ic)), shape=(len(maps["items"]), len(item_names)), dtype=np.float32)
    return user_matrix, item_matrix, {"user_features": user_names, "item_features": item_names}


def interaction_matrix(rows: list[dict[str, Any]], maps: dict[str, Any]):
    train = [r for r in rows if r["split"] == "train"]
    r = [maps["user_index"][x["sim_user_key"]] for x in train]
    c = [maps["item_index"][x["entity_key"]] for x in train]
    values = [float(x["weight"]) for x in train]
    shape = (len(maps["users"]), len(maps["items"]))
    weights_csr = sparse.coo_matrix((values, (r, c)), shape=shape).tocsr()
    binary_csr = weights_csr.copy(); binary_csr.data[:] = 1.0
    # LightFM requires sample weights in COO form with exactly the same logical
    # coordinates as interactions.
    return binary_csr.tocoo(), weights_csr.tocoo()
