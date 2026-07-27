"""Deterministic, labels-only baseline scenario summaries."""
from __future__ import annotations

from typing import Any

SCENARIOS = [
    "Robotics long-term to recent Woodworking", "Woodworking long-term to recent Electronics",
    "Crafts long-term to recent Robotics", "Electronics long-term to recent Fabric",
    "Stable long-term interest", "Random cross-category browsing", "Repeated same-item views",
    "One accidental like", "Like followed by unlike", "Strong reservation evidence",
    "Natural cold user", "Evaluation-masked cold user", "Evaluation-masked cold item",
    "Project-driven abrupt intent",
]


def build_scenarios(label_by_item: dict[str, str], ranked_items: list[str], candidate_count: int) -> list[dict[str, Any]]:
    approved = [label_by_item[item] for item in ranked_items[:10] if item in label_by_item]
    return [{
        "scenario": name, "long_term_profile": approved[:1],
        "recent_behavior_summary": "CONTROLLED_SYNTHETIC_SCENARIO",
        "eligible_candidate_count": candidate_count,
        "baseline_top_5_labels": approved[:5], "baseline_top_10_labels": approved,
        "explanation": "Training-only popularity with approved category context.",
        "known_limitation": "No preference-drift model is trained in Slice 2.",
    } for name in SCENARIOS]
