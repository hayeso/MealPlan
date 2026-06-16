from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mealplan"
    google_client_id: str = ""
    jwt_secret: str = ""
    jwt_expire_hours: int = 168
    allowed_email: str = "hayeson@gmail.com"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    serve_static: bool = False
    openai_api_key: str = ""
    openai_base_url: str = ""
    llm_fast_model: str = "openai/gpt-4o-mini"
    llm_heavy_model: str = "openai/gpt-4o"
    llm_concurrency: int = 5
    container_grouping_ai: bool = True
    debug: bool = True
    # Social recipe import (TikTok / Instagram)
    social_video_extraction: bool = True
    social_import_timeout_secs: int = 120
    social_caption_quality_threshold: float = 0.45
    social_max_video_duration_secs: int = 180
    social_frame_interval_secs: float = 4.0
    social_max_frames: int = 12
    instagram_cookies_file: str = ""
    whisper_model: str = "whisper-1"
    ffmpeg_path: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if value.startswith("postgresql://") and "+asyncpg" not in value:
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()