"""
Configuration for the Similarity Check Index service.

All settings are environment-driven. Copy `.env.example` to `.env` and adjust.
This service is intentionally ISOLATED from the mock IFS assyst system — it only
talks to it over HTTP using the public assystREST API contract. (Issues reported
through blagh are mirrored into assyst, so assyst is the single source of truth.)
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Similarity Check Index"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8090

    # ─── Storage ────────────────────────────────────────────────────────────
    DATA_DIR: str = "./data"                 # root for Chroma + SQLite
    CHROMA_DIR: str = "./data/chroma"        # vector DB persistence
    SQLITE_PATH: str = "./data/similarity.db"  # relational metadata DB

    # ─── mock assyst connector ──────────────────────────────────────────────
    ASSYST_BASE_URL: str = "http://localhost:8081"
    ASSYST_USERNAME: str = "mock_user"
    ASSYST_PASSWORD: str = "change_me"
    ASSYST_EVENT_TYPE: str = "INCIDENT"

    # ─── Sync window ────────────────────────────────────────────────────────
    SYNC_WINDOW_DAYS: int = 7                 # "latest 1 week"
    FETCH_PAGE_SIZE: int = 100

    # ─── Embeddings ─────────────────────────────────────────────────────────
    # "hashing"  → offline deterministic feature-hashing (no download, default)
    # "sentence" → sentence-transformers (requires one-time model download)
    EMBEDDER: str = "hashing"
    EMBEDDING_DIM: int = 768                   # used by the hashing embedder
    ST_MODEL_NAME: str = "all-MiniLM-L6-v2"    # used when EMBEDDER=sentence

    # ─── Similarity engine ──────────────────────────────────────────────────
    TOP_K: int = 5                             # neighbours to retrieve per issue
    VECTOR_WEIGHT: float = 0.7                 # combined = w_v*vec + w_r*rule
    RULE_WEIGHT: float = 0.3
    DUPLICATE_THRESHOLD: float = 0.62          # combined score to flag a pair
    CANDIDATE_THRESHOLD: float = 0.35          # min vector score to consider

    # ─── LLM comparison (OpenAI-compatible; Groq by default) ────────────────
    # Powers (a) the optional batch "judge" during sync/detect and (b) on-demand
    # LLM similarity in the Compare Lab. Groq exposes an OpenAI-compatible Chat
    # Completions API, so the same client works for either provider.
    LLM_ENABLED: bool = True                   # allow the batch judge during sync
    LLM_PROVIDER: str = "groq"                 # "groq" | "openai"
    LLM_JUDGE_THRESHOLD: float = 0.6           # only judge pairs above this combined score
    LLM_TIMEOUT: float = 40.0
    # LLM-only detection (used when the UI "Check with LLM" option is on):
    LLM_DETECT_MIN_SIMILARITY: float = 0.5     # keep/display pairs at/above this LLM score
    LLM_DETECT_MAX_PAIRS: int = 600            # safety cap on issue pairs compared per run
    LLM_DETECT_WORKERS: int = 6                # concurrent LLM calls

    # Groq (OpenAI-compatible) — https://console.groq.com
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "openai/gpt-oss-20b"           # fast model: on-demand compare
    GROQ_JUDGE_MODEL: str = "openai/gpt-oss-120b"    # larger model: duplicate judge

    # OpenAI (or any other OpenAI-compatible endpoint)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ─── CORS ───────────────────────────────────────────────────────────────
    CORS_ORIGINS_STR: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:3100"

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS_STR.split(",") if o.strip()]

    # ─── Resolved LLM settings (provider-aware) ──────────────────────────────
    @property
    def llm_provider(self) -> str:
        return (self.LLM_PROVIDER or "groq").strip().lower()

    @property
    def llm_base_url(self) -> str:
        return self.GROQ_BASE_URL if self.llm_provider == "groq" else self.OPENAI_BASE_URL

    @property
    def llm_api_key(self) -> str:
        return self.GROQ_API_KEY if self.llm_provider == "groq" else self.OPENAI_API_KEY

    @property
    def llm_model(self) -> str:
        return self.GROQ_MODEL if self.llm_provider == "groq" else self.OPENAI_MODEL

    @property
    def llm_judge_model(self) -> str:
        """Larger model used for batch duplicate judging (Compare uses llm_model)."""
        return self.GROQ_JUDGE_MODEL if self.llm_provider == "groq" else self.OPENAI_MODEL


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
