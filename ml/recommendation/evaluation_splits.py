"""Deterministic evaluation-only cold masks; raw simulator artifacts are immutable."""
from __future__ import annotations

import hashlib
from collections import defaultdict
from typing import Any


def _order(namespace: str, value: str) -> str:
    return hashlib.sha256(f"slice2:{namespace}:{value}".encode()).hexdigest()


def build_masks(rows: list[dict[str, Any]], complete_items: set[str], seed: int, domain: str) -> dict[str, Any]:
    train_users: set[str] = set()
    train_items: set[str] = set()
    later_by_user: dict[str, set[str]] = defaultdict(set)
    later_by_item: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        if row["split"] == "train":
            train_users.add(row["sim_user_key"]); train_items.add(row["entity_key"])
        else:
            later_by_user[row["sim_user_key"]].add(row["entity_key"])
            later_by_item[row["entity_key"]].add(row["sim_user_key"])
    eligible_users = sorted(later_by_user, key=lambda x: _order(f"u:{seed}:{domain}", x))
    user_n = min(len(eligible_users), max(1, round(len(eligible_users) * .10))) if eligible_users else 0
    eligible_items = [item for item, users in later_by_item.items() if item in complete_items and len(users) >= 2]
    eligible_items.sort(key=lambda x: _order(f"i:{seed}:{domain}", x))
    target = max(1, round(len(eligible_items) * .10)) if eligible_items else 0
    if domain == "project": target = min(target, 2)
    masked_users, masked_items = set(eligible_users[:user_n]), set(eligible_items[:target])
    training_view = [r for r in rows if r["split"] != "train" or (
        r["sim_user_key"] not in masked_users and r["entity_key"] not in masked_items)]
    return {
        "masked_users": sorted(masked_users), "masked_items": sorted(masked_items),
        "training_view": training_view,
        "natural_cold_users": sorted(set(later_by_user) - train_users),
        "natural_cold_items": sorted(set(later_by_item) - train_items),
        "status": "SUPPORTED" if eligible_users and eligible_items else "INSUFFICIENT_SYNTHETIC_SUPPORT",
    }


def assert_no_mask_leak(mask: dict[str, Any]) -> None:
    for row in mask["training_view"]:
        if row["split"] == "train" and (row["sim_user_key"] in mask["masked_users"] or row["entity_key"] in mask["masked_items"]):
            raise ValueError("masked entity leaked into training view")
