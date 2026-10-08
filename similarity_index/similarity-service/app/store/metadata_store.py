"""
Relational metadata store (SQLite).

Holds the canonical issue records (full text + source payload), sync-run history
and detected duplicate pairs. This is the "separate suitable DB" that complements
the vector index — Chroma holds embeddings, SQLite holds the ground-truth rows.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.models import CanonicalIssue, DuplicatePair, IssueOut, Source, SyncRun


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class MetadataStore:
    def __init__(self, db_path: str) -> None:
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._path = db_path
        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS issues (
                    uid        TEXT PRIMARY KEY,
                    source     TEXT NOT NULL,
                    source_id  TEXT NOT NULL,
                    ref        TEXT,
                    title      TEXT,
                    body       TEXT,
                    priority   TEXT,
                    category   TEXT,
                    status     TEXT,
                    reporter   TEXT,
                    url        TEXT,
                    created_at TEXT,
                    raw_json   TEXT,
                    synced_at  TEXT
                );

                CREATE TABLE IF NOT EXISTS sync_runs (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    started_at   TEXT NOT NULL,
                    finished_at  TEXT,
                    status       TEXT NOT NULL,
                    assyst_count INTEGER DEFAULT 0,
                    pairs_found  INTEGER DEFAULT 0,
                    message      TEXT
                );

                CREATE TABLE IF NOT EXISTS duplicate_pairs (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_a       TEXT NOT NULL,
                    uid_a          TEXT NOT NULL,
                    title_a        TEXT,
                    source_b       TEXT NOT NULL,
                    uid_b          TEXT NOT NULL,
                    title_b        TEXT,
                    cross_source   INTEGER DEFAULT 0,
                    vector_score   REAL DEFAULT 0,
                    rule_score     REAL DEFAULT 0,
                    combined_score REAL DEFAULT 0,
                    llm_verdict    TEXT,
                    llm_confidence REAL,
                    llm_reason     TEXT,
                    detected_at    TEXT,
                    UNIQUE(uid_a, uid_b)
                );
                """
            )

    # ─── Issues ────────────────────────────────────────────────────────────
    def upsert_issues(self, issues: list[CanonicalIssue]) -> None:
        synced = _now()
        rows = [
            (
                i.uid, i.source, i.source_id, i.ref, i.title, i.body, i.priority,
                i.category, i.status, i.reporter, i.url, i.created_at,
                json.dumps(i.raw), synced,
            )
            for i in issues
        ]
        with self._conn() as conn:
            conn.executemany(
                """
                INSERT INTO issues (uid, source, source_id, ref, title, body,
                    priority, category, status, reporter, url, created_at,
                    raw_json, synced_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(uid) DO UPDATE SET
                    ref=excluded.ref, title=excluded.title, body=excluded.body,
                    priority=excluded.priority, category=excluded.category,
                    status=excluded.status, reporter=excluded.reporter,
                    url=excluded.url, created_at=excluded.created_at,
                    raw_json=excluded.raw_json, synced_at=excluded.synced_at
                """,
                rows,
            )

    def list_issues(
        self,
        source: Optional[Source] = None,
        limit: int = 200,
        offset: int = 0,
        q: Optional[str] = None,
    ) -> list[IssueOut]:
        query = "SELECT * FROM issues"
        clauses: list[str] = []
        params: list[Any] = []
        if source:
            clauses.append("source = ?")
            params.append(source)
        if q and q.strip():
            like = f"%{q.strip()}%"
            clauses.append("(title LIKE ? OR body LIKE ?)")
            params += [like, like]
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
        with self._conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [self._row_to_issue(r) for r in rows]

    def get_issue(self, uid: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM issues WHERE uid = ?", (uid,)).fetchone()
        if not row:
            return None
        data = dict(row)
        data["raw"] = json.loads(data.pop("raw_json") or "{}")
        return data

    def all_issues_raw(self) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute("SELECT * FROM issues").fetchall()
        return [dict(r) for r in rows]

    def count_issues(self, source: Optional[Source] = None) -> int:
        with self._conn() as conn:
            if source:
                row = conn.execute(
                    "SELECT COUNT(*) AS c FROM issues WHERE source = ?", (source,)
                ).fetchone()
            else:
                row = conn.execute("SELECT COUNT(*) AS c FROM issues").fetchone()
        return int(row["c"])

    @staticmethod
    def _row_to_issue(row: sqlite3.Row) -> IssueOut:
        return IssueOut(
            uid=row["uid"], source=row["source"], source_id=row["source_id"],
            ref=row["ref"], title=row["title"] or "", body=row["body"] or "",
            priority=row["priority"], category=row["category"], status=row["status"],
            reporter=row["reporter"], url=row["url"], created_at=row["created_at"],
            synced_at=row["synced_at"],
        )

    # ─── Duplicate pairs ─────────────────────────────────────────────────────
    def replace_pairs(self, pairs: list[DuplicatePair]) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM duplicate_pairs")
            conn.executemany(
                """
                INSERT INTO duplicate_pairs (source_a, uid_a, title_a, source_b,
                    uid_b, title_b, cross_source, vector_score, rule_score,
                    combined_score, llm_verdict, llm_confidence, llm_reason, detected_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                [
                    (
                        p.source_a, p.uid_a, p.title_a, p.source_b, p.uid_b, p.title_b,
                        1 if p.cross_source else 0, p.vector_score, p.rule_score,
                        p.combined_score, p.llm_verdict, p.llm_confidence, p.llm_reason,
                        p.detected_at or _now(),
                    )
                    for p in pairs
                ],
            )

    def list_pairs(self, cross_source_only: bool = False) -> list[DuplicatePair]:
        query = "SELECT * FROM duplicate_pairs"
        if cross_source_only:
            query += " WHERE cross_source = 1"
        query += " ORDER BY combined_score DESC"
        with self._conn() as conn:
            rows = conn.execute(query).fetchall()
        return [self._row_to_pair(r) for r in rows]

    def count_pairs(self) -> int:
        with self._conn() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM duplicate_pairs").fetchone()
        return int(row["c"])

    @staticmethod
    def _row_to_pair(row: sqlite3.Row) -> DuplicatePair:
        return DuplicatePair(
            id=row["id"], source_a=row["source_a"], uid_a=row["uid_a"],
            title_a=row["title_a"] or "", source_b=row["source_b"], uid_b=row["uid_b"],
            title_b=row["title_b"] or "", cross_source=bool(row["cross_source"]),
            vector_score=row["vector_score"], rule_score=row["rule_score"],
            combined_score=row["combined_score"], llm_verdict=row["llm_verdict"],
            llm_confidence=row["llm_confidence"], llm_reason=row["llm_reason"],
            detected_at=row["detected_at"],
        )

    # ─── Sync runs ───────────────────────────────────────────────────────────
    def start_run(self) -> int:
        with self._conn() as conn:
            cur = conn.execute(
                "INSERT INTO sync_runs (started_at, status) VALUES (?, 'running')",
                (_now(),),
            )
            return int(cur.lastrowid)

    def finish_run(
        self, run_id: int, status: str, assyst: int, pairs: int, message: str | None
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE sync_runs SET finished_at=?, status=?,
                    assyst_count=?, pairs_found=?, message=? WHERE id=?
                """,
                (_now(), status, assyst, pairs, message, run_id),
            )

    def latest_run(self) -> Optional[SyncRun]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1"
            ).fetchone()
        if not row:
            return None
        return SyncRun(
            id=row["id"], started_at=row["started_at"], finished_at=row["finished_at"],
            status=row["status"], assyst_count=row["assyst_count"],
            pairs_found=row["pairs_found"], message=row["message"],
        )

    def delete_by_source(self, source: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM issues WHERE source = ?", (source,))

    def reset(self) -> None:
        with self._conn() as conn:
            conn.executescript(
                "DELETE FROM issues; DELETE FROM duplicate_pairs; DELETE FROM sync_runs;"
            )
