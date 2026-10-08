from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Mock IFS assyst REST API"
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8081

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "mock_assyst"

    ASSYST_API_VERSION: str = "v2"
    ASSYST_BASE_PATH: str = "/assystREST/v2"

    MOCK_AUTH_ENABLED: bool = True
    MOCK_AUTH_USERNAME: str = "mock_user"
    MOCK_AUTH_PASSWORD: str = "change_me"
    MOCK_AUTH_BYPASS: bool = False

    SEED_DATA_ENABLED: bool = True
    SEED_DATA_COUNT: int = 100

    LOG_LEVEL: str = "INFO"

    FAULT_INJECTION_ENABLED: bool = False
    FAULT_INJECTION_ERROR_RATE: float = 0.0
    FAULT_INJECTION_DELAY_MS: int = 0

    PAGINATION_DEFAULT_SIZE: int = 25
    PAGINATION_MAX_SIZE: int = 100

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    SIMILARITY_INDEX_URL: Optional[str] = None


settings = Settings()
