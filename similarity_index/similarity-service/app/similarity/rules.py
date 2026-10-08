"""
Rule-based similarity scoring.

A transparent, explainable signal that complements the vector similarity:
  * token Jaccard overlap on normalized title+body
  * exact priority match bonus
  * exact category match bonus

Returns a score in [0, 1]. Kept deliberately simple and deterministic so it is
easy to reason about in a POC demo.
"""
from __future__ import annotations

import re
from typing import Optional

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "is", "are", "was",
    "were", "be", "to", "of", "in", "on", "for", "with", "as", "at", "by",
    "it", "this", "that", "when", "while", "from", "not", "page", "error",
}

JACCARD_WEIGHT = 0.7
PRIORITY_WEIGHT = 0.15
CATEGORY_WEIGHT = 0.15


def _tokens(text: str) -> set[str]:
    return {t for t in _TOKEN_RE.findall((text or "").lower()) if t not in _STOPWORDS and len(t) > 1}


def jaccard(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0


def rule_score(
    text_a: str,
    text_b: str,
    priority_a: Optional[str] = None,
    priority_b: Optional[str] = None,
    category_a: Optional[str] = None,
    category_b: Optional[str] = None,
) -> float:
    score = JACCARD_WEIGHT * jaccard(text_a, text_b)
    if priority_a and priority_b and priority_a.strip().lower() == priority_b.strip().lower():
        score += PRIORITY_WEIGHT
    if category_a and category_b and category_a.strip().lower() == category_b.strip().lower():
        score += CATEGORY_WEIGHT
    return max(0.0, min(1.0, score))
