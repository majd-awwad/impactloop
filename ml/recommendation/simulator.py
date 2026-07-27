"""Deterministic exposure-first synthetic behavior simulator (no model code)."""

from __future__ import annotations

import hashlib
import json
import math
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

from .schemas import SYNTHETIC_ORIGIN


def split_for_day(day: int) -> str:
    return "train" if day <= 21 else "validation" if day <= 25 else "test"


def _op(namespace: str, *parts: object) -> str:
    return hashlib.sha256(
        (namespace + ":" + ":".join(map(str, parts))).encode()
    ).hexdigest()


def _weighted_choice(rng: random.Random, weights: dict[str, float]) -> str:
    return rng.choices(list(weights), weights=list(weights.values()), k=1)[0]


def _persona_rows(
    seed: int, cfg: dict[str, Any], interests: list[str]
) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    cohorts = cfg["cohort_distribution"]
    activity = cfg["activity_distribution"]
    locations = ["north", "central", "south", "metro", "regional"]
    rows = []
    for index in range(1, cfg["persona_count"] + 1):
        primary = rng.choice(interests)
        second = rng.choice([x for x in interests if x != primary])
        cohort = _weighted_choice(rng, cohorts)
        rows.append(
            {
                "sim_user_key": f"sim_user_{index:04d}",
                "origin": SYNTHETIC_ORIGIN,
                "primary_interest": primary,
                "secondary_interest": second if rng.random() < 0.58 else "",
                "location_bucket": rng.choices(locations, [18, 31, 17, 24, 10], k=1)[0],
                "free_preference": round(rng.betavariate(2.4, 1.8), 6),
                "delivery_preference": round(rng.random(), 6),
                "exploration_tendency": round(rng.betavariate(2, 3), 6),
                "popularity_sensitivity": round(rng.random(), 6),
                "activity_band": _weighted_choice(rng, activity),
                "project_driven_tendency": round(rng.random(), 6),
                "cohort": cohort,
                "simulator_seed": seed,
            }
        )
    return rows


def _episodes(
    personas: list[dict[str, Any]], interests: list[str], seed: int
) -> list[dict[str, Any]]:
    rng = random.Random(seed + 901)
    rows = []
    for p in personas:
        count = (
            0
            if p["cohort"] == "stable"
            else rng.choices([0, 1, 2], [15, 65, 20], k=1)[0]
        )
        if p["cohort"] == "abrupt_task":
            count = max(1, count)
        for n in range(count):
            start = rng.randint(2, 25)
            duration = rng.randint(3, 8 if p["cohort"] == "abrupt_task" else 12)
            intent = rng.choice([x for x in interests if x != p["primary_interest"]])
            rows.append(
                {
                    "episode_key": _op("hidden-episode", seed, p["sim_user_key"], n),
                    "sim_user_key": p["sim_user_key"],
                    "origin": SYNTHETIC_ORIGIN,
                    "intent_key": intent,
                    "start_day": start,
                    "end_day": min(30, start + duration),
                    "transition": "GRADUAL"
                    if p["cohort"] == "gradual_shift"
                    else "ABRUPT",
                    "simulator_seed": seed,
                }
            )
    return rows


def simulate(
    catalog: dict[str, Any], cfg: dict[str, Any], seed: int
) -> dict[str, list[dict[str, Any]]]:
    random.seed(seed)
    np_rng = np.random.default_rng(seed)
    rng = random.Random(seed)
    variant = cfg["variants"].get(seed, cfg["variants"].get(str(seed)))
    materials, projects = catalog["materials"], catalog["projects"]
    interests = sorted({r["category_key"] for r in [*materials, *projects]})
    personas = _persona_rows(seed, cfg, interests)
    episodes = _episodes(personas, interests, seed)
    episode_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in episodes:
        episode_map[row["sim_user_key"]].append(row)
    anchor = datetime.fromisoformat(cfg["fixed_utc_anchor"].replace("Z", "+00:00"))
    start = anchor - timedelta(days=29)
    impressions: list[dict[str, Any]] = []
    actions: list[dict[str, Any]] = []
    view_counts: Counter[tuple[str, str, int]] = Counter()
    event_probs = cfg["event_probabilities"]

    for p in personas:
        low, high = cfg["session_adjustment"][p["activity_band"]]
        session_count = rng.randint(low, high)
        days = sorted(rng.sample(range(1, 31), session_count))
        for session_n, day in enumerate(days):
            ts = start + timedelta(
                days=day - 1, hours=rng.randint(8, 19), minutes=rng.randint(0, 40)
            )
            domain = (
                "project"
                if rng.random()
                < (variant["project_tendency"] + 0.25 * p["project_driven_tendency"])
                else "material"
            )
            pool = projects if domain == "project" else materials
            key_field = f"{domain}_key"
            eligible = [
                r
                for r in pool
                if datetime.fromisoformat(
                    r["publication_timestamp"].replace("Z", "+00:00")
                )
                <= ts
            ]
            if len(eligible) < cfg["exposure_count_bounds"][0]:
                continue
            slate_size = rng.randint(*cfg["exposure_count_bounds"])
            random_count = max(1, round(slate_size * variant["exploration_rate"]))
            current = p["primary_interest"]
            for ep in episode_map[p["sim_user_key"]]:
                if ep["start_day"] <= day <= ep["end_day"]:
                    current = ep["intent_key"]
            policy_ranked = sorted(
                eligible,
                key=lambda item: (
                    item["category_key"] != current,
                    item["category_key"] != p["primary_interest"],
                    hashlib.sha256(
                        f"{seed}:{p['sim_user_key']}:{day}:{item[key_field]}".encode()
                    ).hexdigest(),
                ),
            )
            random_items = rng.sample(eligible, min(random_count, len(eligible)))
            selected = list(random_items)
            for item in policy_ranked:
                if item not in selected and len(selected) < slate_size:
                    selected.append(item)
            rng.shuffle(selected)
            session_key = _op("session", seed, p["sim_user_key"], session_n)
            for rank, item in enumerate(selected):
                source = (
                    "RANDOM_EXPLORATION" if item in random_items else "POLICY_SELECTED"
                )
                imp_ts = ts + timedelta(seconds=rank * 5)
                imp_key = _op("impression", session_key, rank, item[key_field])
                utility = (
                    1.2 * (item["category_key"] == current)
                    + variant["loyalty"]
                    * (item["category_key"] == p["primary_interest"])
                    + 0.35 * rng.random()
                    + float(np_rng.normal(0, 0.45))
                )
                impressions.append(
                    {
                        "impression_key": imp_key,
                        "session_key": session_key,
                        "sim_user_key": p["sim_user_key"],
                        "entity_key": item[key_field],
                        "domain": domain,
                        "timestamp_utc": imp_ts.isoformat().replace("+00:00", "Z"),
                        "day": day,
                        "split": split_for_day(day),
                        "rank": rank + 1,
                        "source": source,
                        "engaged": False,
                        "origin": SYNTHETIC_ORIGIN,
                        "simulator_seed": seed,
                    }
                )
                bounded = 1 / (1 + math.exp(-utility))
                action_ts = imp_ts
                made_action = False

                def add(action_type: str, op_group: str, outcome: str = "") -> None:
                    nonlocal action_ts, made_action
                    action_ts += timedelta(seconds=rng.randint(3, 25))
                    actions.append(
                        {
                            "action_key": _op(
                                "action", seed, imp_key, len(actions), action_type
                            ),
                            "operation_key": _op("operation", seed, imp_key, op_group),
                            "impression_key": imp_key,
                            "session_key": session_key,
                            "sim_user_key": p["sim_user_key"],
                            "entity_key": item[key_field],
                            "domain": domain,
                            "action_type": action_type,
                            "outcome": outcome,
                            "timestamp_utc": action_ts.isoformat().replace(
                                "+00:00", "Z"
                            ),
                            "day": day,
                            "split": split_for_day(day),
                            "origin": SYNTHETIC_ORIGIN,
                            "simulator_seed": seed,
                        }
                    )
                    made_action = True

                scale = variant["action_scale"]
                if (
                    domain == "material"
                    and rng.random() < event_probs["view"] * bounded * scale
                ):
                    cap_key = (p["sim_user_key"], item[key_field], day)
                    if view_counts[cap_key] < cfg["repeat_view_cap_per_item_day"]:
                        view_counts[cap_key] += 1
                        add("view", f"view-{view_counts[cap_key]}")
                like_p = (
                    event_probs["material_like"]
                    if domain == "material"
                    else event_probs["project_like"]
                )
                if rng.random() < like_p * bounded * scale:
                    add("like", "like")
                    if rng.random() < cfg["reversal_probabilities"]["like"]:
                        add("unlike", "like")
                if (
                    domain == "material"
                    and rng.random() < event_probs["reservation"] * bounded * scale
                ):
                    outcome = _weighted_choice(rng, cfg["reservation_outcomes"])
                    add("reservation_created", "reservation")
                    add(f"reservation_{outcome}", "reservation", outcome.upper())
                if domain == "project":
                    for positive, reverse, prob in [
                        ("save", "unsave", event_probs["save"]),
                        ("follow", "unfollow", event_probs["follow"]),
                    ]:
                        if rng.random() < prob * bounded * scale:
                            add(positive, positive)
                            if rng.random() < cfg["reversal_probabilities"][positive]:
                                add(reverse, positive)
                    if rng.random() < event_probs["build_started"] * bounded * scale:
                        outcome = _weighted_choice(rng, cfg["build_outcomes"])
                        add("build_started", "build")
                        add(f"build_{outcome}", "build", outcome.upper())
                if made_action:
                    impressions[-1]["engaged"] = True

    resolved = _resolve(actions, cfg, anchor)
    splits = [
        {
            "operation_key": r["operation_key"],
            "sim_user_key": r["sim_user_key"],
            "entity_key": r["entity_key"],
            "domain": r["domain"],
            "split": r["split"],
            "origin": SYNTHETIC_ORIGIN,
            "simulator_seed": seed,
        }
        for r in resolved
    ]
    return {
        "personas": personas,
        "impressions": impressions,
        "actions": actions,
        "material_interactions": [r for r in resolved if r["domain"] == "material"],
        "project_interactions": [r for r in resolved if r["domain"] == "project"],
        "splits": splits,
        "hidden_state": episodes,
    }


def _resolve(
    actions: list[dict[str, Any]], cfg: dict[str, Any], anchor: datetime
) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for action in actions:
        groups[action["operation_key"]].append(action)
    weights = {
        "view": 0.4,
        "like": 1.2,
        "save": 1.1,
        "follow": 1.0,
        "reservation_created": 1.0,
        "build_started": 1.0,
    }
    outcome_weights = {
        "COMPLETED": 2.5,
        "ACCEPTED": 1.7,
        "MEANINGFUL_PROGRESS": 1.8,
        "CANCELLED": 0.3,
        "REJECTED": 0.15,
        "EXPIRED": 0.1,
        "ABANDONED": 0.2,
    }
    rows = []
    for operation, chain in sorted(groups.items()):
        chain.sort(key=lambda x: x["timestamp_utc"])
        types = [x["action_type"] for x in chain]
        if types[-1] in {"unlike", "unsave", "unfollow"}:
            continue
        last = chain[-1]
        base = outcome_weights.get(last["outcome"], weights.get(types[0], 0.6))
        age = (
            anchor
            - datetime.fromisoformat(last["timestamp_utc"].replace("Z", "+00:00"))
        ).total_seconds() / 86400
        decay = 0.5 ** (max(0, age) / cfg["time_decay_half_life_days"])
        rows.append(
            {
                "operation_key": operation,
                "sim_user_key": last["sim_user_key"],
                "entity_key": last["entity_key"],
                "domain": last["domain"],
                "resolved_action": types[-1],
                "outcome": last["outcome"],
                "weight": round(min(3.0, max(0.05, base * decay)), 6),
                "timestamp_utc": last["timestamp_utc"],
                "split": last["split"],
                "origin": SYNTHETIC_ORIGIN,
                "simulator_seed": last["simulator_seed"],
            }
        )
    return rows


def logical_hash(dataset: dict[str, list[dict[str, Any]]]) -> str:
    normalized = {
        name: sorted(rows, key=lambda row: json.dumps(row, sort_keys=True))
        for name, rows in sorted(dataset.items())
    }
    return hashlib.sha256(
        json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
