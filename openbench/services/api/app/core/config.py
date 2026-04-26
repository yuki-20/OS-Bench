from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # App
    app_env: str = "development"
    app_name: str = "OpenBench OS"
    app_base_url: str = "http://localhost:3000"

    # Auth
    jwt_secret: str = "change-me-please-use-a-long-random-string"
    jwt_alg: str = "HS256"
    jwt_access_ttl_min: int = 60
    jwt_refresh_ttl_days: int = 30

    # Database
    use_sqlite: bool = False
    sqlite_path: str = ".local/openbench.sqlite3"
    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_db: str = "openbench"
    postgres_user: str = "openbench"
    postgres_password: str = "openbench"

    # Redis
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # Object storage
    storage_backend: str = "s3"  # "s3" | "local"
    local_storage_root: str = ".local/storage"
    s3_endpoint_url: str = "http://minio:9000"
    s3_public_base_url: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_bucket: str = "openbench"
    s3_access_key: str = "minio"
    s3_secret_key: str = "minio12345"

    # AI
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-7"
    # Same ID as the primary model — Q&A + safety reviewer also run on Opus.
    anthropic_fast_model: str = "claude-opus-4-7"
    anthropic_vision_model: str = "claude-opus-4-7"
    # Maximum output tokens for Opus 4.7. Input context is 1,000,000 tokens
    # and is enforced by the model, not a client setting.
    anthropic_max_tokens: int = 64000
    # Comma-separated `anthropic-beta` feature flags forwarded on every call.
    anthropic_beta: str = ""

    # CORS
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:1420,http://127.0.0.1:1420,tauri://localhost"
    )

    # Webhook
    webhook_signing_secret: str = "replace-me"

    # Email / SMTP (notifications). When `smtp_host` is empty, the notify
    # service is a no-op so dev environments don't need a mail server.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from_address: str = "openbench@localhost"
    smtp_from_name: str = "OpenBench OS"

    # Upload safety
    max_document_upload_bytes: int = 25 * 1024 * 1024
    max_attachment_upload_bytes: int = 10 * 1024 * 1024

    # Demo seed
    seed_org_name: str = "Demo Lab"
    seed_org_slug: str = "demo-lab"
    seed_reviewer_email: str = "reviewer@demo.lab"
    seed_operator_email: str = "operator@demo.lab"
    seed_admin_email: str = "admin@demo.lab"
    seed_password: str = "Bench!Demo1"

    @model_validator(mode="after")
    def validate_runtime_secrets(self) -> "Settings":
        if self.app_env.lower() in {"development", "dev", "test", "testing"}:
            return self
        weak = {
            "jwt_secret": {
                "change-me-please",
                "change-me-please-use-a-long-random-string",
            },
            "webhook_signing_secret": {"replace-me"},
            "postgres_password": {"openbench", "postgres", "password"},
            "s3_secret_key": {"minio12345", "password"},
            "seed_password": {"Bench!Demo1"},
        }
        bad = [name for name, values in weak.items() if getattr(self, name) in values]
        if bad:
            raise ValueError(
                "Unsafe default secrets are not allowed outside development: "
                + ", ".join(sorted(bad))
            )
        if len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters outside development")
        if len(self.webhook_signing_secret) < 32:
            raise ValueError(
                "WEBHOOK_SIGNING_SECRET must be at least 32 characters outside development"
            )
        return self

    @property
    def database_url(self) -> str:
        if self.use_sqlite:
            sqlite_path = Path(self.sqlite_path)
            sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite+aiosqlite:///{sqlite_path.as_posix()}"
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        if self.use_sqlite:
            sqlite_path = Path(self.sqlite_path)
            sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{sqlite_path.as_posix()}"
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
