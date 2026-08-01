"""Candidate-bound deterministic LightFM scoring."""
from __future__ import annotations

from typing import Any

import numpy as np


def rank_lightfm(model: Any, user: str, candidates: list[str], maps: dict[str, Any],
                 user_features, item_features) -> list[str]:
    if not candidates: return []
    user_index = maps["user_index"][user]
    item_indices = np.array([maps["item_index"][item] for item in candidates], dtype=np.int32)
    scores = model.predict(user_index, item_indices, user_features=user_features,
                           item_features=item_features, num_threads=1)
    return [item for _, item in sorted(zip(scores.tolist(), candidates), key=lambda value: (-value[0], value[1]))]
