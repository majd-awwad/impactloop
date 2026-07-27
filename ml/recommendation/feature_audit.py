"""Privacy-safe feature cardinality audit for the reviewed catalog snapshot."""
from __future__ import annotations

from collections import Counter
from statistics import median
from typing import Any, Iterable


def _percentile(values: list[int], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    lo, hi = int(position), min(int(position) + 1, len(ordered) - 1)
    return round(ordered[lo] + (ordered[hi] - ordered[lo]) * (position - lo), 3)


def cardinality(values: Iterable[str]) -> dict[str, Any]:
    vals = [value for value in values if value and value.lower() != "unknown"]
    counts = Counter(vals)
    frequencies = list(counts.values())
    total = len(vals)
    singletons = sum(value == 1 for value in frequencies)
    return {
        "unique_count": len(counts), "observed_count": total,
        "singleton_count": singletons,
        "singleton_percentage": round(100 * singletons / max(1, len(counts)), 3),
        "p50_frequency": median(frequencies) if frequencies else 0,
        "p75_frequency": _percentile(frequencies, .75),
        "p90_frequency": _percentile(frequencies, .90),
        "maximum_frequency": max(frequencies, default=0),
    }


def audit_features(catalog: dict[str, Any]) -> dict[str, Any]:
    materials, projects = catalog["materials"], catalog["projects"]
    type_stats = cardinality(row["material_type"] for row in materials)
    missing_types = sum(row["material_type"] == "unknown" for row in materials)
    # Relation-backed but nearly item-unique controlled values are unsuitable as
    # collaborative side features; broader taxonomy concepts retain semantics.
    type_classification = (
        "EXCLUDE_HIGH_CARDINALITY_FEATURE"
        if type_stats["unique_count"] / max(1, len(materials)) > .50
        else "APPROVED_AS_MODEL_FEATURE"
    )
    concept_overlap = sum(bool(row["concept_keys"]) for row in materials)
    approved = lambda stats: {**stats, "classification": "APPROVED_AS_MODEL_FEATURE"}
    return {
        "material_type": {
            **type_stats, "missing_rate": round(missing_types / max(1, len(materials)), 6),
            "source": "CONTROLLED_MATERIAL_TYPES_RELATION",
            "taxonomy_overlap_item_rate": round(concept_overlap / max(1, len(materials)), 6),
            "classification": type_classification,
            "review_examples": sorted({r["material_type_label"] for r in materials})[:8],
        },
        "material_category": approved(cardinality(r["category_key"] for r in materials)),
        "material_taxonomy_concepts": approved(cardinality(k for r in materials for k in r["concept_keys"])),
        "material_location_bucket": {"classification": "EXCLUDED_NOT_EXPORTED", "unique_count": 0},
        "project_topic": approved(cardinality(r["category_key"] for r in projects)),
        "project_taxonomy_concepts": approved(cardinality(k for r in projects for k in r["concept_keys"])),
        "project_required_components": approved(cardinality(k for r in projects for k in r["component_concept_keys"])),
    }
