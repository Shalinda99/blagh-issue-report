"""
Pluggable embedding providers.

Two implementations are offered:

* HashingEmbedder (default) — a fully offline, deterministic feature-hashing
  vectorizer over word + character n-grams. No model download, no network, and
  a fixed output dimension so it drops straight into a vector DB. Great for a
  POC and surprisingly strong at catching near-duplicate / paraphrased text.

* SentenceTransformerEmbedder — wraps `sentence-transformers` for true semantic
  embeddings. Requires a one-time model download. Selected via EMBEDDER=sentence.

All embedders return L2-normalized vectors so cosine similarity == dot product.
"""
from __future__ import annotations

import hashlib
import math
import re
from typing import List, Protocol

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "is", "are", "was",
    "were", "be", "been", "to", "of", "in", "on", "for", "with", "as", "at",
    "by", "it", "this", "that", "these", "those", "i", "we", "you", "they",
    "my", "our", "your", "when", "while", "from", "not", "no", "so", "up",
}


def _normalize(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0:
        return vec
    return [v / norm for v in vec]


def _tokenize(text: str) -> List[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS and len(t) > 1]


class Embedder(Protocol):
    dim: int

    def embed(self, texts: List[str]) -> List[List[float]]: ...


class HashingEmbedder:
    """Offline, deterministic word+char n-gram feature hashing with TF weighting."""

    def __init__(self, dim: int = 768) -> None:
        self.dim = dim

    def _hash(self, token: str) -> tuple[int, float]:
        h = hashlib.md5(token.encode("utf-8")).digest()
        idx = int.from_bytes(h[:4], "big") % self.dim
        sign = 1.0 if (h[4] & 1) == 0 else -1.0
        return idx, sign

    def _features(self, text: str) -> List[str]:
        tokens = _tokenize(text)
        features: List[str] = list(tokens)
        # word bigrams — capture short phrases
        features += [f"{a}_{b}" for a, b in zip(tokens, tokens[1:])]
        # character trigrams of each token — robustness to typos / morphology
        for tok in tokens:
            padded = f"#{tok}#"
            features += [f"c:{padded[i:i + 3]}" for i in range(len(padded) - 2)]
        return features

    def embed(self, texts: List[str]) -> List[List[float]]:
        out: List[List[float]] = []
        for text in texts:
            vec = [0.0] * self.dim
            for feat in self._features(text or ""):
                idx, sign = self._hash(feat)
                vec[idx] += sign
            # sublinear scaling tames very long documents
            vec = [math.copysign(math.log1p(abs(v)), v) for v in vec]
            out.append(_normalize(vec))
        return out


class SentenceTransformerEmbedder:
    """Semantic embeddings via sentence-transformers (lazy import)."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        from sentence_transformers import SentenceTransformer  # type: ignore

        self._model = SentenceTransformer(model_name)
        self.dim = int(self._model.get_sentence_embedding_dimension())

    def embed(self, texts: List[str]) -> List[List[float]]:
        vectors = self._model.encode(
            [t or "" for t in texts],
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return [v.tolist() for v in vectors]


def build_embedder(kind: str, dim: int, model_name: str) -> Embedder:
    if kind == "sentence":
        return SentenceTransformerEmbedder(model_name=model_name)
    return HashingEmbedder(dim=dim)


def cosine(a: List[float], b: List[float]) -> float:
    """Cosine similarity for already- or not-yet-normalized vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
