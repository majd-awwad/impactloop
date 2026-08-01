"""Reviewed Slice 1 snapshot and generated-row contracts."""
from __future__ import annotations

CATALOG_ORIGIN = "IMPACTLOOP_CATALOG_READ_ONLY_SNAPSHOT"
SYNTHETIC_ORIGIN = "SYNTHETIC_SIMULATION"
SNAPSHOT_SCHEMA_VERSION = "impactloop-catalog-snapshot-v2"

MATERIAL_FIELDS = {
    "material_key", "category_key", "category_label", "material_type",
    "material_type_label", "concept_keys", "concept_labels", "condition",
    "is_free", "price_bucket", "pickup_allowed", "delivery_allowed",
    "public_state", "publication_timestamp",
}
PROJECT_FIELDS = {
    "project_key", "category_key", "category_label", "concept_keys", "concept_labels",
    "difficulty", "component_concept_keys", "component_concept_labels",
    "public_state", "publication_timestamp",
}
PROHIBITED_FIELDS = {
    "id", "raw_id", "user_id", "owner_id", "supplier_id", "supplier_profile_id",
    "name", "title", "email", "phone", "address", "address_line", "latitude",
    "longitude", "coordinates", "description", "short_description", "notes",
    "token", "password", "connection_string", "database_url", "image_url",
}
