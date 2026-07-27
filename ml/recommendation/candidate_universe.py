"""Shared time-aware candidate universe for every offline ranker."""
from __future__ import annotations

from datetime import datetime
from typing import Any


class CandidateUniverse:
    def __init__(self, catalog: dict[str, Any], impressions: list[dict[str, Any]]):
        self.items = {
            "material": {r["material_key"]: r for r in catalog["materials"]},
            "project": {r["project_key"]: r for r in catalog["projects"]},
        }
        self.impressions = impressions

    def candidates(self, user: str, domain: str, timestamp: str, train_seen: set[str],
                   universe: str = "PRIMARY", source: str | None = None,
                   protocol_exclusions: set[str] | None = None) -> list[str]:
        cutoff = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        eligible = {key for key, row in self.items[domain].items()
                    if datetime.fromisoformat(row["publication_timestamp"].replace("Z", "+00:00")) <= cutoff}
        eligible -= train_seen | (protocol_exclusions or set())
        if universe == "DIAGNOSTIC":
            exposed = {r["entity_key"] for r in self.impressions
                       if r["sim_user_key"] == user and r["domain"] == domain
                       and r["timestamp_utc"] <= timestamp and (source is None or r["source"] == source)}
            eligible &= exposed
        elif universe != "PRIMARY":
            raise ValueError("unknown evaluation universe")
        return sorted(eligible)
