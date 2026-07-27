"""Training-only popularity baselines. No simulator utility or hidden state."""
from __future__ import annotations

from collections import Counter
from typing import Any


def popularity(training_rows: list[dict[str, Any]]) -> Counter[str]:
    return Counter({}) + Counter({item: sum(float(r["weight"]) for r in training_rows
                                  if r["split"] == "train" and r["entity_key"] == item)
                                for item in {r["entity_key"] for r in training_rows if r["split"] == "train"}})


def rank_global(candidates: list[str], scores: Counter[str]) -> list[str]:
    return sorted(candidates, key=lambda item: (-scores[item], item))


def rank_interest(candidates: list[str], scores: Counter[str], persona: dict[str, Any],
                  item_metadata: dict[str, dict[str, Any]]) -> list[str]:
    interests = {persona["primary_interest"], persona.get("secondary_interest", "")}
    # A bounded category match breaks popularity ties without copying hidden
    # simulator intent, coefficients, exposure rank, or future behavior.
    return sorted(candidates, key=lambda item: (
        -(scores[item] + .20 * (item_metadata[item]["category_key"] in interests)), item))
