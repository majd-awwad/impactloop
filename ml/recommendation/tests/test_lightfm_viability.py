"""Unit tests for Slice 0B matrix preflight validation."""

from __future__ import annotations

import numpy as np
import pytest
from scipy import sparse

from ml.recommendation.viability import MatrixPreflightError, preflight_sparse_matrix


def test_preflight_consolidates_duplicate_coordinates() -> None:
    matrix = sparse.coo_matrix(
        (np.array([0.25, 0.75, 1.0]), ([0, 0, 1], [0, 0, 1])),
        shape=(2, 3),
    )
    canonical = preflight_sparse_matrix(
        matrix,
        expected_shape=(2, 3),
        name="duplicate_matrix",
        k=3,
    )
    assert canonical.nnz == 2
    assert canonical[0, 0] == 1.0
    assert canonical.has_canonical_format
    assert canonical.has_sorted_indices


@pytest.mark.parametrize(
    ("name", "matrix", "expected"),
    [
        (
            "all_items_positive",
            sparse.csr_matrix(np.ones((1, 3), dtype=np.float32)),
            "non-positive",
        ),
        (
            "nan_weight",
            sparse.csr_matrix(np.array([[np.nan, 0.0]], dtype=np.float32)),
            "NaN",
        ),
        (
            "negative_weight",
            sparse.csr_matrix(np.array([[-1.0, 0.0]], dtype=np.float32)),
            "non-positive",
        ),
    ],
)
def test_preflight_rejects_invalid_inputs(name: str, matrix: sparse.spmatrix, expected: str) -> None:
    with pytest.raises(MatrixPreflightError, match=expected):
        preflight_sparse_matrix(
            matrix,
            expected_shape=matrix.shape,
            name=name,
            k=matrix.shape[1],
        )


def test_preflight_rejects_invalid_feature_values() -> None:
    interactions = sparse.csr_matrix([[1.0, 0.0], [0.0, 1.0]])
    features = sparse.csr_matrix([[1.0, -1.0], [0.0, 1.0]])
    with pytest.raises(MatrixPreflightError, match="feature matrix"):
        preflight_sparse_matrix(
            interactions,
            expected_shape=(2, 2),
            name="interactions",
            feature_matrix=features,
            feature_rows=2,
        )
