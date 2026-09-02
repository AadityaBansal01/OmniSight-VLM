import pytest
from app.ai.vector_store import _compute_lexical_score, SYNONYM_MAP

def test_compute_lexical_score_exact_match():
    caption = "A black SUV is parked in the underground garage."
    score = _compute_lexical_score("black SUV", caption)
    assert score >= 80.0

def test_compute_lexical_score_synonym_expansion():
    # Query uses "vehicle", caption uses "car"
    caption = "A red car is driving slowly near the gate."
    score = _compute_lexical_score("vehicle", caption)
    assert score > 0.0
    assert "car" in SYNONYM_MAP["vehicle"]

def test_compute_lexical_score_negation_awareness():
    # "no cars" should NOT boost match on a car caption
    caption = "A car parked on the driveway."
    score_positive = _compute_lexical_score("car", caption)
    score_negative = _compute_lexical_score("no cars", caption)
    assert score_negative < score_positive

def test_compute_lexical_score_no_match():
    caption = "Pedestrians walking across the street."
    score = _compute_lexical_score("bicycle", caption)
    assert score == 0.0

def test_compute_lexical_score_empty_or_whitespace():
    assert _compute_lexical_score("", "Some caption") == 0.0
    assert _compute_lexical_score("   ", "Some caption") == 0.0
