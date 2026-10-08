from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_SECRET_KEY = "CHANGE_ME_IN_PRODUCTION"
_DEFAULT_ADMIN_PASSWORD = "ChangeThisPassword!"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "development"
    APP_NAME: str = "Blagh API"
    APP_VERSION: str = "1.0.0"
    SECRET_KEY: str = _DEFAULT_SECRET_KEY

    # ─── MongoDB ──────────────────────────────────────────────────────────────
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "blagh"

    # ─── MinIO ────────────────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_BUCKET: str = "blagh-reports"
    MINIO_PRESIGN_EXPIRES_HOURS: int = 24

    # Stored as a comma-separated string in .env — use the allowed_origins property
    ALLOWED_ORIGINS_STR: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175"

    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS_STR.split(",") if o.strip()]

    # ─── Assyst mirroring (IFS assyst / mocked_assyst) ──────────────────────────
    # Every blagh report is mirrored into assyst as an INCIDENT so that assyst
    # remains the single source of truth for the similarity index.
    ASSYST_MIRROR_ENABLED: bool = True
    ASSYST_BASE_URL: str = "http://localhost:8081"
    ASSYST_USERNAME: str = "mock_user"
    ASSYST_PASSWORD: str = "change_me"
    ASSYST_EVENT_TYPE: str = "INCIDENT"
    ASSYST_TIMEOUT_SECONDS: float = 15.0

    # Base URL of the admin UI used to build the deep link embedded in the
    # assyst incident so staff can open the full diagnostics (console logs,
    # failed API calls, screenshots, recordings) for the report.
    ADMIN_UI_BASE_URL: str = "http://localhost:5175"

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    INITIAL_ADMIN_EMAIL: str = "admin@blagh.internal"
    INITIAL_ADMIN_PASSWORD: str = "ChangeThisPassword!"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @model_validator(mode="after")
    def _check_secrets(self) -> "Settings":
        if self.is_production and self.SECRET_KEY == _DEFAULT_SECRET_KEY:
            raise ValueError(
                "SECRET_KEY must be changed from the default value in production. "
                "Set the SECRET_KEY environment variable."
            )
        if self.is_production and self.INITIAL_ADMIN_PASSWORD == _DEFAULT_ADMIN_PASSWORD:
            raise ValueError(
                "INITIAL_ADMIN_PASSWORD must be changed from the default value in production. "
                "Set the INITIAL_ADMIN_PASSWORD environment variable."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
