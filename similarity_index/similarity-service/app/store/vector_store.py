"""
Vector store backed by ChromaDB (persistent).

Indexed issues live in a single assyst collection:
  * assyst_issues

Embeddings are computed by our own `Embedder` and passed in directly, so Chroma
is used purely as a cosine-similarity ANN index + metadata store.
"""
from __future__ import annotations

from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.models import CanonicalIssue, Source

_COLLECTIONS: dict[Source, str] = {
    "assyst": "assyst_issues",
}


class VectorStore:
    def __init__(self, persist_dir: str) -> None:
        self._client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True),
        )
        self._collections = {
            source: self._client.get_or_create_collection(
                name=name, metadata={"hnsw:space": "cosine"}
            )
            for source, name in _COLLECTIONS.items()
        }

    def upsert(self, issues: list[CanonicalIssue], embeddings: list[list[float]]) -> None:
        by_source: dict[Source, dict[str, list]] = {
            s: {"ids": [], "embeddings": [], "metadatas": [], "documents": []}
            for s in _COLLECTIONS
        }
        for issue, emb in zip(issues, embeddings):
            bucket = by_source[issue.source]
            bucket["ids"].append(issue.uid)
            bucket["embeddings"].append(emb)
            bucket["metadatas"].append(
                {
                    "source": issue.source,
                    "source_id": issue.source_id,
                    "ref": issue.ref or "",
                    "title": issue.title,
                    "priority": issue.priority or "",
                    "category": issue.category or "",
                    "status": issue.status or "",
                }
            )
            bucket["documents"].append(issue.embedding_text())

        for source, bucket in by_source.items():
            if bucket["ids"]:
                self._collections[source].upsert(
                    ids=bucket["ids"],
                    embeddings=bucket["embeddings"],
                    metadatas=bucket["metadatas"],
                    documents=bucket["documents"],
                )

    def get_embedding(self, source: Source, uid: str) -> list[float] | None:
        res = self._collections[source].get(ids=[uid], include=["embeddings"])
        embs = res.get("embeddings")
        if embs is not None and len(embs) > 0:
            return list(embs[0])
        return None

    def query(
        self, source: Source, embedding: list[float], top_k: int, exclude_uid: str | None = None
    ) -> list[dict[str, Any]]:
        """Return nearest neighbours in a source collection as score+metadata dicts."""
        n = top_k + (1 if exclude_uid else 0)
        res = self._collections[source].query(
            query_embeddings=[embedding],
            n_results=max(n, 1),
            include=["metadatas", "distances", "documents"],
        )
        ids = res.get("ids", [[]])[0]
        dists = res.get("distances", [[]])[0]
        metas = res.get("metadatas", [[]])[0]
        docs = res.get("documents", [[]])[0]
        out: list[dict[str, Any]] = []
        for uid, dist, meta, doc in zip(ids, dists, metas, docs):
            if exclude_uid and uid == exclude_uid:
                continue
            out.append(
                {
                    "uid": uid,
                    "score": _distance_to_similarity(dist),
                    "metadata": meta,
                    "document": doc,
                }
            )
        return out[:top_k]

    def count(self, source: Source) -> int:
        return self._collections[source].count()

    def clear_source(self, source: Source) -> None:
        name = _COLLECTIONS[source]
        try:
            self._client.delete_collection(name)
        except Exception:
            pass
        self._collections[source] = self._client.get_or_create_collection(
            name=name, metadata={"hnsw:space": "cosine"}
        )

    def reset(self) -> None:
        for source, name in _COLLECTIONS.items():
            try:
                self._client.delete_collection(name)
            except Exception:
                pass
            self._collections[source] = self._client.get_or_create_collection(
                name=name, metadata={"hnsw:space": "cosine"}
            )


def _distance_to_similarity(distance: float) -> float:
    """Chroma cosine 'distance' is 1 - cosine_similarity; convert back and clamp."""
    sim = 1.0 - float(distance)
    return max(0.0, min(1.0, sim))
